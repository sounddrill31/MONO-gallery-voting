#!/usr/bin/env python3
import sys
import os
import re
import requests
import subprocess
from datetime import datetime
import yaml


def extract_sheet_id(url):
    """
    Extract the Google Sheet ID from the public Google Sheets URL.
    """
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url)
    if not match:
        raise ValueError("Invalid Google Sheets URL: Could not find sheet ID.")
    return match.group(1)


def download_csv(sheet_id):
    """
    Download the CSV export of the first worksheet of the public Google Sheets using the sheet ID.
    """
    csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    response = requests.get(csv_url)
    if response.status_code != 200:
        raise RuntimeError(f"Failed to download CSV: HTTP {response.status_code}")
    return response.content


def run_shell_command(command):
    """
    Run a shell command in the current directory.
    Raises RuntimeError if the command fails.
    """
    result = subprocess.run(command, shell=True)
    if result.returncode != 0:
        raise RuntimeError(f"Command '{command}' failed with exit code {result.returncode}")


def main():
    if len(sys.argv) not in (1,2):
        print("Usage: ci.py [public_google_sheet_url]", file=sys.stderr)
        sys.exit(1)

    # Delete data.csv if it exists to ensure a clean start
    if os.path.exists("data.csv"):
        try:
            os.remove("data.csv")
            print("Removed existing data.csv")
        except OSError as e:
            print(f"Error removing existing file: {e}", file=sys.stderr)
            sys.exit(1) # Exit if we can't remove the old file

    sheet_url = sys.argv[1] if len(sys.argv)==2 else None

    have_csv = False
    if sheet_url:
        try:
            sheet_id = extract_sheet_id(sheet_url)
            csv_data = download_csv(sheet_id)
            with open("data.csv", "wb") as f:
                f.write(csv_data)
            have_csv = True
        except Exception as e:
            print(f"Warning: Could not download CSV ({e}). Will check config timing to decide if this is acceptable.", file=sys.stderr)

    # If we still don't have data.csv, decide if we can proceed empty (pre-submission or submission)
    if not have_csv:
        allow_empty = True
        try:
            if os.path.exists('config.yaml'):
                with open('config.yaml','r',encoding='utf-8') as cf:
                    cfg = yaml.safe_load(cf) or {}
                deadlines = (cfg or {}).get('deadlines', {})
                now = datetime.now().timestamp()
                def parse(ts):
                    if not ts: return None
                    for fmt in ('%Y-%m-%d %H:%M:%S','%Y-%m-%dT%H:%M:%S'):
                        try:
                            return datetime.strptime(ts, fmt).timestamp()
                        except ValueError:
                            continue
                    return None
                so = parse(deadlines.get('submit_open'))
                sc = parse(deadlines.get('submit_close'))
                if so and now < so:
                    allow_empty = True
                elif so and sc and so <= now <= sc:
                    allow_empty = True
                else:
                    allow_empty = False
        except Exception as e:
            print(f"Warning: Could not evaluate config deadlines ({e}); defaulting to allow empty.")
            allow_empty = True
        if not allow_empty:
            print("Error: No CSV available and submission window ended; cannot proceed.", file=sys.stderr)
            sys.exit(2)
        else:
            print("Proceeding without data.csv (empty teams) due to current phase (pre-submission/submission).")

    try:
        run_shell_command("pixi run prepare")
    except Exception as e:
        print(f"Error running 'pixi run prepare': {e}", file=sys.stderr)
        sys.exit(4)

    if have_csv:
        print("Downloaded data.csv and successfully ran 'pixi run prepare'")
    else:
        print("Successfully generated site with empty teams (no CSV yet).")


if __name__ == "__main__":
    main()
