#!/usr/bin/env python3
import csv
import os
import re
import yaml


def generate_teams_yaml(csv_path='data.csv', yaml_path='teams.yaml'):
    """
    Reads team data from a CSV file, processes it, and writes it to a YAML file.
    Handles different submission image column formats.
    """
    # Delete teams.yaml if it exists to ensure a clean start
    if os.path.exists(yaml_path):
        try:
            os.remove(yaml_path)
            print(f"Removed existing {yaml_path}")
        except OSError as e:
            print(f"Error removing existing file: {e}")
            return # Exit if we can't remove the old file

    teams = []
    extra_stats = {}
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        return

    # --- Read raw rows first (preserve duplicate headers) ---
    with open(csv_path, mode='r', encoding='utf-8') as infile:
        reader_raw = list(csv.reader(infile))
    if not reader_raw:
        print("CSV empty")
        return
    headers = reader_raw[0]
    data_rows = reader_raw[1:]

    # Build index mapping for main required fields (first occurrence wins)
    def find_index(name):
        try:
            return headers.index(name)
        except ValueError:
            return None

    idx_position = find_index('Position')
    idx_team_number = find_index('Team Number')
    idx_team_name = find_index('Team Name')
    idx_submission_image = find_index('Submission Image')
    idx_public_vote = find_index('Final Round Public Voting Result(%)')

    extra_stat_pattern = re.compile(r"^(?P<title>.+?)\(extra stat\)(?:\((?P<chart>pie|bar)\))?(?:\((?P<group>[12])\))?$", re.IGNORECASE)
    # For extra stats keep all indexes (can duplicate header names)
    extra_stat_columns = {}  # title -> {chart, idxs: { '1':[], '2':[] }, has_group: bool}
    for idx, h in enumerate(headers):
        m = extra_stat_pattern.match(h.strip()) if h else None
        if not m:
            continue
        title = m.group('title').strip()
        chart = (m.group('chart') or '').lower() or None
        group = m.group('group') or '1'  # default to group 1 when unspecified
        if title not in extra_stat_columns:
            extra_stat_columns[title] = { 'chart': chart, 'idxs': { '1': [], '2': [] }, 'has_group': False }
        if m.group('group'):
            extra_stat_columns[title]['has_group'] = True
        extra_stat_columns[title]['idxs'][group].append(idx)

    for i, row in enumerate(data_rows):
        if not row or all((c is None or str(c).strip()=='' for c in row)):
            continue
        team_name = (row[idx_team_name] if idx_team_name is not None and idx_team_name < len(row) else '').strip()
        team_number = (row[idx_team_number] if idx_team_number is not None and idx_team_number < len(row) else '').strip()
        if not team_name or not team_number:
            continue

        images = []
        if idx_submission_image is not None and idx_submission_image < len(row):
            if row[idx_submission_image].strip():
                images.append(f"image/{team_number}/Photo.avif")
        # (multi-image variant omitted for brevity in this dataset)

        position = (row[idx_position] if idx_position is not None and idx_position < len(row) else '').strip()

        public_vote_percent = None
        if idx_public_vote is not None and idx_public_vote < len(row):
            raw_vote = row[idx_public_vote].strip()
            if raw_vote:
                try:
                    public_vote_percent = float(raw_vote)
                except ValueError:
                    pass

        team_data = {
            "teamName": team_name,
            "team_number": team_number,
            "images": images,
            "description": "Submission.",
            "rank": position if position else i + 1,
            "public_vote_percent": public_vote_percent
        }
        teams.append(team_data)

        # Collect extra stats per row
        for title, meta in extra_stat_columns.items():
            chart = meta['chart']
            if title not in extra_stats:
                extra_stats[title] = { 'chart': chart }
                if chart in ('pie','bar'):
                    extra_stats[title]['data'] = []

            # Chart types expecting label/value pairs
            if chart in ('pie','bar'):
                has_group = meta['has_group']
                idxs1 = meta['idxs']['1']
                idxs2 = meta['idxs']['2']
                # Case 1: Proper grouping (1)/(2)
                if has_group and idxs1 and idxs2:
                    for p in range(min(len(idxs1), len(idxs2))):
                        lab = row[idxs1[p]] if idxs1[p] < len(row) else ''
                        val_raw = row[idxs2[p]] if idxs2[p] < len(row) else ''
                        lab = (lab or '').strip(); val_raw = (val_raw or '').strip()
                        if lab and val_raw:
                            try:
                                val = float(val_raw)
                            except ValueError:
                                val = val_raw
                            extra_stats[title]['data'].append({ 'label': lab, 'value': val })
                else:
                    # Heuristic: duplicate group-1 columns representing label/value pairs (e.g., copied header mistake)
                    if len(idxs1) >= 2:
                        label_col = idxs1[0]
                        value_col = idxs1[1]
                        lab = row[label_col] if label_col < len(row) else ''
                        val_raw = row[value_col] if value_col < len(row) else ''
                        lab = (lab or '').strip(); val_raw = (val_raw or '').strip()
                        # Only add if value part looks numeric or label part non-numeric to avoid garbage
                        if lab and val_raw:
                            try:
                                val = float(val_raw)
                            except ValueError:
                                # if both strings, skip to avoid header repetition noise
                                try:
                                    float(lab)
                                    # both numeric-like -> skip
                                    continue
                                except ValueError:
                                    val = val_raw
                            extra_stats[title]['data'].append({ 'label': lab, 'value': val })
                    else:
                        # Fallback: treat each populated cell as value with header text as label (legacy behavior)
                        for idx_col in idxs1:
                            val_raw = row[idx_col] if idx_col < len(row) else ''
                            val_raw = (val_raw or '').strip()
                            if val_raw:
                                try:
                                    val = float(val_raw)
                                except ValueError:
                                    val = val_raw
                                extra_stats[title].setdefault('data', []).append({ 'label': headers[idx_col], 'value': val })
            else:
                # Non-chart single aggregate: first non-empty captured
                if 'value' not in extra_stats[title]:
                    for idx_col in meta['idxs']['1']:
                        val_raw = row[idx_col] if idx_col < len(row) else ''
                        val_raw = (val_raw or '').strip()
                        if val_raw:
                            try:
                                extra_stats[title]['value'] = float(val_raw)
                            except ValueError:
                                extra_stats[title]['value'] = val_raw
                            break

    with open(yaml_path, 'w', encoding='utf-8') as outfile:
        out_obj = {"teams": teams}
        if extra_stats:
            out_obj['extra_stats'] = extra_stats
        yaml.dump(out_obj, outfile, default_flow_style=False, sort_keys=False)

    print(f"Successfully generated {yaml_path} with {len(teams)} teams and {len(extra_stats)} extra stats groups.")


if __name__ == "__main__":
    generate_teams_yaml()

