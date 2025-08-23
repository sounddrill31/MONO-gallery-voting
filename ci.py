#!/usr/bin/env python3
import sys
import os
import re
import requests
import subprocess


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
    if len(sys.argv) != 2:
        print("Usage: ci.py <public_google_sheet_url>", file=sys.stderr)
        sys.exit(1)

    # Delete data.csv if it exists to ensure a clean start
    if os.path.exists("data.csv"):
        try:
            os.remove("data.csv")
            print("Removed existing data.csv")
        except OSError as e:
            print(f"Error removing existing file: {e}", file=sys.stderr)
            sys.exit(1) # Exit if we can't remove the old file

    sheet_url = sys.argv[1]

    try:
        sheet_id = extract_sheet_id(sheet_url)
        csv_data = download_csv(sheet_id)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(2)

    try:
        with open("data.csv", "wb") as f:
            f.write(csv_data)
    except Exception as e:
        print(f"Error saving file: {e}", file=sys.stderr)
        sys.exit(3)

    try:
        run_shell_command("pixi run prepare")
    except Exception as e:
        print(f"Error running 'pixi run prepare': {e}", file=sys.stderr)
        sys.exit(4)

    print("Downloaded data.csv and successfully ran 'pixi run prepare'")


if __name__ == "__main__":
    main()
