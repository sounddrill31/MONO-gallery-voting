#!/usr/bin/env python3
import csv
import os
import yaml

def generate_teams_yaml(csv_path='data.csv', yaml_path='teams.yaml'):
    """
    Reads team data from a CSV file, processes it, and writes it to a YAML file.
    Handles different submission image column formats.
    """
    teams = []
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        return

    with open(csv_path, mode='r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        headers = reader.fieldnames
        has_single_submission = 'Submission Image' in headers
        
        for i, row in enumerate(reader):
            # Skip empty rows where all values can be None
            if not row or not any(row.values()):
                continue

            team_name = (row.get('Team Name') or '').strip()
            team_number = (row.get('Team Number') or '').strip()
            if not team_name or not team_number:
                continue

            images = []
            if has_single_submission:
                if row.get('Submission Image'):
                    images.append(f"image/{team_number}/Photo.avif")
            else:
                for j in range(1, 5):
                    if row.get(f'Submission Image {j}'):
                        images.append(f"image/{team_number}/Photo{j}.avif")
            
            position = (row.get('Position') or '').strip()

            team_data = {
                "teamName": team_name,
                "team_number": team_number,
                "images": images,
                "description": f"Submission from {(row.get('COURSE') or 'N/A')}.",
                "rank": position if position else i + 1
            }
            teams.append(team_data)

    with open(yaml_path, 'w', encoding='utf-8') as outfile:
        yaml.dump({"teams": teams}, outfile, default_flow_style=False, sort_keys=False)

    print(f"Successfully generated {yaml_path} with {len(teams)} teams.")

if __name__ == "__main__":
    import yaml
    generate_teams_yaml()
