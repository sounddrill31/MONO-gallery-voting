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


            # Simple template replacements
            content = content.replace('{{SITE_TITLE}}', self.config.get('site_title', 'Photo Gallery'))
            content = content.replace('{{FOOTER_TEXT}}', self.config.get('footer', {}).get('text', ''))
            content = content.replace('{{MONO_LINK}}', self.config.get('footer', {}).get('mono_link', ''))


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


def main():
    generator = GalleryGenerator()
    generator.generate_all()


if __name__ == '__main__':
    main()
