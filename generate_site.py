#!/usr/bin/env python3
"""
Photography Contest Gallery Generator - MONO Design System
Server-side rendering approach with templates and YAML data
"""


import yaml
import json
import os
import shutil
from datetime import datetime
from pathlib import Path


class GalleryGenerator:
    def __init__(self):
        self.base_dir = Path('.')
        self.templates_dir = self.base_dir / 'templates'
        self.output_dir = self.base_dir / 'dist'
        self.teams_data = None
        self.config = None


    def load_data(self):
        """Load config from config.yaml and team data from teams.yaml"""
        try:
            with open('config.yaml', 'r', encoding='utf-8') as f:
                self.config = yaml.safe_load(f)
            with open('teams.yaml', 'r', encoding='utf-8') as f:
                teams_yaml = yaml.safe_load(f)
                self.teams_data = teams_yaml.get('teams', [])
                extra_stats = teams_yaml.get('extra_stats')
                if extra_stats:
                    # Attach to config so frontend can access via CONFIG_DATA_PLACEHOLDER
                    self.config['extra_stats'] = extra_stats
            print("✓ Data loaded successfully.")
            return True
        except FileNotFoundError as e:
            print(f"✗ Error: {e.filename} not found.")
            return False
        except Exception as e:
            print(f"✗ Error loading data: {e}")
            return False


    def setup_output(self):
        """Create and clean output directory"""
        if self.output_dir.exists():
            shutil.rmtree(self.output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # The downloader script now places images directly in dist/image,
        # so we just need to ensure the parent 'dist' directory is clean.
        # If there are other static assets, they can be copied here.
        print(f"✓ Setup output directory: {self.output_dir}")



    def generate_html(self):
        """Generate index.html from template"""
        template_path = self.templates_dir / 'index.html'
        output_path = self.output_dir / 'index.html'


        try:
            with open(template_path, 'r', encoding='utf-8') as f:
                content = f.read()


            # Compute server-side results (winners, charts, extra stats) so modal opens instantly without heavy client JS loops
            winners_html, winner_gallery_html, public_vote_svg, public_vote_legend, extra_stats_html, winner_preloads = self.build_results_fragments()

            # Simple template replacements (ordered to avoid accidental re-replacement)
            replacements = {
                '{{SITE_TITLE}}': self.config.get('site_title', 'Photo Gallery'),
                '{{FOOTER_TEXT}}': self.config.get('footer', {}).get('text', ''),
                '{{MONO_LINK}}': self.config.get('footer', {}).get('mono_link', ''),
                '{{WINNERS_LIST_HTML}}': winners_html,
                '{{WINNER_GALLERY_HTML}}': winner_gallery_html,
                '{{PUBLIC_VOTE_CHART_SVG}}': public_vote_svg,
                '{{PUBLIC_VOTE_LEGEND_HTML}}': public_vote_legend,
                '{{EXTRA_STATS_HTML}}': extra_stats_html,
                '{{WINNER_PRELOAD_LINKS}}': winner_preloads,
            }
            for k,v in replacements.items():
                content = content.replace(k, v)


            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)


            print(f"✓ Generated: {output_path}")
            return True


        except Exception as e:
            print(f"✗ Error generating HTML: {e}")
            return False


    def generate_css(self):
        """Copy style.css from template"""
        template_path = self.templates_dir / 'style.css'
        output_path = self.output_dir / 'style.css'
        try:
            shutil.copy(template_path, output_path)
            print(f"✓ Generated: {output_path}")
            return True
        except Exception as e:
            print(f"✗ Error generating CSS: {e}")
            return False


    def generate_js(self):
        """Generate script.js from template with embedded data"""
        template_path = self.templates_dir / 'script.js'
        output_path = self.output_dir / 'script.js'


        try:
            with open(template_path, 'r', encoding='utf-8') as f:
                content = f.read()


            # Anonymize team data if needed
            teams_for_js = self.teams_data
                # Backward compatibility: if hide_team_data present and show_team_data absent, leave behavior to frontend logic
                # No additional processing required here; frontend will interpret flags.


            # Embed team data and config as JSON
            teams_json = json.dumps(teams_for_js, indent=2)
            config_json = json.dumps(self.config, indent=2)
            
            # Replace placeholders
            content = content.replace("const TEAMS_DATA_PLACEHOLDER = '{{TEAMS_DATA}}';", f"const TEAMS_DATA_PLACEHOLDER = {teams_json};")
            content = content.replace("const CONFIG_DATA_PLACEHOLDER = '{{CONFIG_DATA}}';", f"const CONFIG_DATA_PLACEHOLDER = {config_json};")

            # Flag to tell frontend results are pre-rendered
            content = content.replace('const CONFIG_DATA_PLACEHOLDER =', 'const RESULTS_PRERENDERED = true;\nconst CONFIG_DATA_PLACEHOLDER =')



            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✓ Generated: {output_path}")
            return True
        except Exception as e:
            print(f"✗ Error generating JavaScript: {e}")
            return False


    def generate_all(self):
        """Generate the complete website"""
        print("=" * 60)
        print("🎨 PHOTOGRAPHY CONTEST GALLERY GENERATOR")
        print("=" * 60)
        
        if not self.load_data():
            return


        self.setup_output()
        
        # --- Start of new code ---
        # Copy 'public' directory to 'dist' if it exists
        public_dir = self.base_dir / 'public'
        if public_dir.exists() and public_dir.is_dir():
            destination = self.output_dir
            try:
                shutil.copytree(public_dir, destination, dirs_exist_ok=True)
                print(f"✓ Copied '{public_dir}' to '{destination}'")
            except Exception as e:
                print(f"✗ Error copying public directory: {e}")
        # --- End of new code ---
        
        success = all([
            self.generate_html(),
            self.generate_css(),
            self.generate_js()
        ])


        if success:
            print("=" * 60)
            print("🎉 WEBSITE GENERATED SUCCESSFULLY!")
            print(f"📁 Output: {self.output_dir}")
            print(f"🌐 Open '{self.output_dir.resolve()}/index.html' in your browser")
            print("=" * 60)
        else:
            print("\n✗ Generation failed!")

    # ----------------- Server-Side Results Helpers -----------------
    def build_results_fragments(self):
        """Return tuple of (winners_html, winner_gallery_html, public_vote_svg, public_vote_legend_html, extra_stats_html, winner_preloads)."""
        if not self.teams_data:
            return ('','','','','','')
        # Determine if names should be hidden in results modal based on config
        hide_names = self.should_hide_names_server('results')

        def disp(team):
            if hide_names:
                r = team.get('rank') or team.get('position') or '?'
                return f"Submission #{r}"
            return team.get('teamName') or team.get('team_name') or 'Team'

        # Winners: sort by rank ascending
        sorted_by_rank = sorted(self.teams_data, key=lambda t: self.safe_float(t.get('rank'), 9999))
        winners = sorted_by_rank[:3]
        winners_fragments = []
        medals = ['🥇','🥈','🥉']
        for i,team in enumerate(winners):
            img = (team.get('images') or [''])[0]
            percent = team.get('public_vote_percent')
            percent_html = f"<span class=\"text-xs block mt-1 opacity-70\">{percent}% public vote</span>" if percent is not None else ''
            winners_fragments.append(
                f"<div class=\"winner-card mono-border p-4 flex flex-col gap-3\">"
                f"<div class=\"aspect-square overflow-hidden border border-black/20\"><img loading=\"lazy\" src=\"{img}\" alt=\"{disp(team)}\" class=\"object-cover w-full h-full\" /></div>"
                f"<div><h4 class=\"font-bold tracking-wide text-sm\">{medals[i]} {disp(team)}</h4>{percent_html}</div>"
                f"</div>"
            )
        winners_html = ''.join(winners_fragments)

        # Preload <link> tags for top winner images (improves perceived modal open)
        winner_preloads = []
        for team in winners:
            img = (team.get('images') or [''])[0]
            if not img:
                continue
            as_attr = 'image'
            winner_preloads.append(f'<link rel="preload" href="{img}" as="{as_attr}" imagesrcset="{img}" />')
        winner_preloads_html = '\n    '.join(winner_preloads)

        # Winner gallery: order by public vote desc then rank asc
        def vote_key(t):
            pv = t.get('public_vote_percent')
            return -pv if isinstance(pv,(int,float)) else 999999
        sorted_by_vote = sorted(self.teams_data, key=lambda t: (vote_key(t), self.safe_float(t.get('rank'),9999)))
        gallery_parts = []
        for idx,team in enumerate(sorted_by_vote):
            medal = medals[idx] if idx < 3 else ''
            img = (team.get('images') or [''])[0]
            pv = team.get('public_vote_percent')
            pv_html = f"{pv}% vote" if pv is not None else ''
            gallery_parts.append(
                f"<div class=\"winner-gallery-card flex flex-col border border-black/30 bg-white hover:shadow-md transition-shadow\">"
                f"<div class=\"h-40 overflow-hidden\"><img loading=\"lazy\" src=\"{img}\" alt=\"{disp(team)}\" class=\"object-cover w-full h-full\" /></div>"
                f"<div class=\"p-3 flex flex-col flex-grow\">"
                f"<div class=\"flex items-center justify-between text-xs font-mono mb-1\"><span class=\"font-bold\">{disp(team)}</span><span>{medal}</span></div>"
                f"<div class=\"text-[10px] opacity-70 mt-auto\">{pv_html}</div>"
                f"</div></div>"
            )
        winner_gallery_html = ''.join(gallery_parts)

        # Public vote chart (SVG concentric dash circles)
        vote_data = [t for t in self.teams_data if isinstance(t.get('public_vote_percent'), (int,float))]
        public_vote_svg = ''
        public_vote_legend = ''
        if vote_data:
            vote_data_sorted = sorted(vote_data, key=lambda t: -t.get('public_vote_percent'))
            total = sum(t.get('public_vote_percent') for t in vote_data_sorted) or 1
            size = 260
            radius = size/2
            circ = 3.141592653589793 * 2 * radius
            cumulative = 0.0
            circles = []
            legend_items = []
            for i,t in enumerate(vote_data_sorted):
                val = t.get('public_vote_percent')
                frac = val / total
                dash = frac * circ
                gap = circ - dash
                label = disp(t)
                circles.append(f"<circle r=\"{radius}\" cx=\"{radius}\" cy=\"{radius}\" fill=\"transparent\" stroke=\"hsl(0,0%,{15+i*8}%)\" stroke-width=\"{radius}\" stroke-dasharray=\"{dash} {gap}\" stroke-dashoffset=\"{-cumulative * circ}\" data-label=\"{label}\"></circle>")
                legend_items.append(f"<div class=\"flex items-center gap-1\"><span class=\"inline-block w-3 h-3\" style=\"background:hsl(0,0%,{15+i*8}%);\"></span><span class=\"text-[10px] uppercase tracking-wide\">{label} – {val}%</span></div>")
                cumulative += frac
            public_vote_svg = f"<svg viewBox=\"0 0 {size} {size}\" class=\"mono-pie\">{''.join(circles)}</svg>"
            public_vote_legend = ''.join(legend_items)

        # Extra stats
        extra_stats_html = self.render_extra_stats_server(hide_names)
        return winners_html, winner_gallery_html, public_vote_svg, public_vote_legend, extra_stats_html, winner_preloads_html

    def render_extra_stats_server(self, hide_names):
        stats = self.config.get('extra_stats') or {}
        if not stats:
            return ''
        parts = []
        # The logic mirrors frontend buildMiniPie / buildMiniBar
        for raw_title, obj in stats.items():
            title = raw_title.strip()
            chart = obj.get('chart')
            if 'value' in obj and obj.get('value') is not None:
                parts.append(f"<div class=\"extra-stat-card mono-border p-4 bg-white flex flex-col\"><h4 class=\"font-bold mb-2 text-sm uppercase tracking-wide\">{title}</h4><div class=\"text-3xl font-mono\">{obj['value']}</div></div>")
            elif isinstance(obj.get('data'), list) and obj['data']:
                data = obj['data']
                if chart == 'pie':
                    size=160; radius=size/2; circ=3.141592653589793*2*radius; total=sum((d.get('value') or 0) for d in data) or 1; cumulative=0.0; circles=[]; legend=[]
                    for i,d in enumerate(data):
                        val = d.get('value') or 0
                        frac = val/total
                        dash = frac*circ
                        gap = circ - dash
                        circles.append(f"<circle r=\"{radius}\" cx=\"{radius}\" cy=\"{radius}\" fill=\"transparent\" stroke=\"hsl(0,0%,{20+i*10}%)\" stroke-width=\"{radius}\" stroke-dasharray=\"{dash} {gap}\" stroke-dashoffset=\"{-cumulative * circ}\"></circle>")
                        legend.append(f"<span class=\"flex items-center gap-1 text-[10px]\"><span class=\"w-2 h-2 inline-block\" style=\"background:hsl(0,0%,{20+i*10}%);\"></span>{d.get('label')}<span class=\"font-mono\">{val}</span></span>")
                        cumulative+=frac
                    parts.append(f"<div class=\"extra-stat-card mono-border p-4 bg-white flex flex-col\"><h4 class=\"font-bold mb-2 text-sm uppercase tracking-wide\">{title}</h4><svg viewBox=\"0 0 {size} {size}\" class=\"mini-pie\">{''.join(circles)}</svg><div class=\"flex flex-wrap gap-1 mt-2\">{''.join(legend)}</div></div>")
                elif chart == 'bar':
                    max_val = max([d.get('value') or 0 for d in data] + [1])
                    rows=[]
                    for i,d in enumerate(data):
                        val = d.get('value') or 0
                        pct = (val/max_val)*100
                        rows.append(f"<div class=\"text-xs\"><div class=\"flex justify-between mb-1\"><span>{d.get('label')}</span><span class=\"font-mono\">{val}</span></div><div class=\"h-2 w-full bg-gray-200 relative overflow-hidden\"><div class=\"h-full\" style=\"width:{pct}%;background:hsl(0,0%,{20+i*10}%);\"></div></div></div>")
                    parts.append(f"<div class=\"extra-stat-card mono-border p-4 bg-white flex flex-col\"><h4 class=\"font-bold mb-3 text-sm uppercase tracking-wide\">{title}</h4><div class=\"space-y-2\">{''.join(rows)}</div></div>")
                else:
                    # Simple list fallback
                    li = [f"<li class=\"flex justify-between\"><span>{d.get('label')}</span><span class=\"font-mono\">{d.get('value')}</span></li>" for d in data]
                    parts.append(f"<div class=\"extra-stat-card mono-border p-4 bg-white\"><h4 class=\"font-bold mb-2 text-sm uppercase tracking-wide\">{title}</h4><ul class=\"space-y-1 text-xs\">{''.join(li)}</ul></div>")
        return ''.join(parts)

    def should_hide_names_server(self, phase):
        cfg = self.config or {}
        # Legacy flag
        if cfg.get('hide_team_data') and not cfg.get('show_team_data'):
            return True if phase != 'results' else False  # legacy showed names at results implicitly
        show_flag = cfg.get('show_team_data')
        if show_flag is None:
            return False  # default show
        if isinstance(show_flag, str):
            sf = show_flag.lower()
            if sf == 'all':
                return False
            if sf == 'none':
                return True
            return sf != phase
        if isinstance(show_flag, list):
            return phase not in [s.lower() for s in show_flag]
        return False

    @staticmethod
    def safe_float(val, default):
        try:
            return float(val)
        except (TypeError, ValueError):
            return default


def main():
    generator = GalleryGenerator()
    generator.generate_all()


if __name__ == '__main__':
    main()
