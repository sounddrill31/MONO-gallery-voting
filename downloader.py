#!/usr/bin/env python3


"""
Google Drive File Organizer for Event Submissions


This script downloads files from Google Drive links and organizes them into a structured format.
By default converts all downloaded images directly to AVIF (small size, high quality) unless run with --uncompressed.
PDF files are converted to AVIF via pymupdf (fitz) rendering either directly or through PNG intermediate.
Supports HEIC and HEIF image formats via pillow_heif integration.
If a downloaded file is saved as .bin, this script inspects the content to detect PDF signatures before deciding conversion.
"""

import os
import re
import sys
import csv
import time
import mimetypes
import requests
import shutil
from pathlib import Path
from PIL import Image

import pillow_avif  # registers AVIF support in Pillow
import fitz  # PyMuPDF for PDF rendering


# For HEIF/HEIC support lazy load
_has_heif_support = False
def register_heif_if_needed():
    global _has_heif_support
    if not _has_heif_support:
        try:
            from pillow_heif import register_heif_opener
            register_heif_opener()
            _has_heif_support = True
        except ImportError:
            print("⚠️ pillow_heif not installed; HEIC/HEIF support disabled.")


def extract_file_id_from_drive_url(url):
    if not url or 'drive.google.com' not in url:
        return None
    patterns = [
        r'id=([a-zA-Z0-9_-]+)',
        r'/d/([a-zA-Z0-9_-]+)',
        r'file/d/([a-zA-Z0-9_-]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def get_file_extension_from_headers(headers):
    content_type = headers.get('content-type', '').lower()
    extension_map = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/bmp': '.bmp',
        'image/webp': '.webp',
        'image/tiff': '.tiff',
        'application/pdf': '.pdf',
        'image/heic': '.heic',
        'image/heif': '.heif',
    }
    ext = extension_map.get(content_type)
    if ext:
        return ext
    guessed_ext = mimetypes.guess_extension(content_type)
    if guessed_ext:
        return guessed_ext
    return '.bin'


def log_failure(message):
    with open('failed.txt', 'a') as log:
        log.write(message + "\n")


def is_pdf_file(path):
    """Simple check of PDF file signature (starts with %PDF)"""
    try:
        with open(path, 'rb') as f:
            header = f.read(5)
            return header == b'%PDF-'
    except Exception:
        return False


def convert_pdf_to_avif(input_path):
    try:
        doc = fitz.open(input_path)
        if doc.page_count < 1:
            raise RuntimeError("PDF has no pages")
        page = doc.load_page(0)
        pix = page.get_pixmap(alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        avif_path = os.path.splitext(input_path)[0] + '.avif'
        img.save(avif_path, format='AVIF', quality=80, speed=6)
        doc.close()
        os.remove(input_path)
        print(f"Converted PDF {input_path} to {avif_path} (AVIF, quality=80)")
        return avif_path
    except Exception as e:
        log_failure(f"PDF to AVIF conversion failed for {input_path}: {e}")
        return None


def convert_to_avif_high_quality(input_path):
    try:
        # Open and convert the image
        with Image.open(input_path) as im:
            avif_path = os.path.splitext(input_path)[0] + '.avif'
            im.save(avif_path, format='AVIF', quality=80, speed=6)
        
        # Verify the AVIF file was created and is not empty
        if os.path.exists(avif_path) and os.path.getsize(avif_path) > 1024:  # Ensure file is > 1KB
            # Explicitly delete the original file
            os.remove(input_path)
            print(f"Converted {input_path} to {avif_path} (AVIF, quality=80)")
            print(f"Deleted original file: {input_path}")
            return avif_path
        else:
            log_failure(f"AVIF file {avif_path} was not created or is too small")
            return None
    except Exception as e:
        log_failure(f"AVIF conversion failed for {input_path}: {e}")
        return None

def download_file_from_drive(file_id, output_base, uncompressed=False, max_retries=3):
    session = requests.Session()
    base_url = "https://drive.google.com/uc?export=download&id={}"

    for attempt in range(max_retries):
        try:
            response = session.get(base_url.format(file_id), stream=True)
            if 'download_warning' in response.text:
                for line in response.text.splitlines():
                    if 'confirm=' in line:
                        token = re.search(r'confirm=([^&]+)', line).group(1)
                        response = session.get(f"{base_url.format(file_id)}&confirm={token}", stream=True)
                        break
            if response.status_code != 200:
                log_failure(f"Download failed (HTTP {response.status_code}) for ID {file_id}")
                time.sleep(2)
                continue

            ext = get_file_extension_from_headers(response.headers)

            # Save raw file
            raw_path = output_base.replace('.avif', ext)
            os.makedirs(os.path.dirname(raw_path), exist_ok=True)
            with open(raw_path, 'wb') as f:
                for chunk in response.iter_content(8192):
                    if chunk:
                        f.write(chunk)
            print(f"✓ Downloaded: {raw_path}")

            if uncompressed:
                return True

            # If got .bin file, try to detect PDF or HEIC/HEIF
            if ext == '.bin':
                if is_pdf_file(raw_path):
                    ext = '.pdf'
                    # Rename to .pdf for clarity
                    new_path = os.path.splitext(raw_path)[0] + '.pdf'
                    os.rename(raw_path, new_path)
                    raw_path = new_path
                    print(f"ℹ️ Detected PDF content in .bin, renamed to {raw_path}")
                else:
                    # Assume heif/heic candidate, register support
                    ext = '.heic'  # or .heif, pick .heic as default
                    new_path = os.path.splitext(raw_path)[0] + ext 
                    os.rename(raw_path, new_path)
                    raw_path = new_path
                    print(f"ℹ️ Treated .bin as HEIC/HEIF, renamed to {raw_path}")
                    register_heif_if_needed()

            if ext == '.pdf':
                print(f"ℹ️ Attempting PDF to AVIF conversion for {raw_path}")
                avif_path = convert_pdf_to_avif(raw_path)
                if avif_path:
                    print(f"✓ PDF converted to AVIF: {avif_path}")
                    return True
                else:
                    print(f"✗ PDF to AVIF conversion failed for {raw_path}")
                    return False

            elif ext.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.heic', '.heif']:
                avif_path = convert_to_avif_high_quality(raw_path)
                if avif_path:
                    return True
                else:
                    print(f"✗ AVIF conversion failed for {raw_path}")
                    return False

            return True

        except Exception as e:
            log_failure(f"Attempt {attempt+1} exception for ID {file_id}: {e}")
            time.sleep(2)

    return False


DIRECT_IMAGE_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif', '.heic', '.heif', '.avif'
}

VIDEO_PLATFORMS = (
    'youtube.com', 'youtu.be', 'odysee.com', 'piped.', 'piped.video'
)

def is_video_platform(url: str) -> bool:
    if not url:
        return False
    lower = url.lower()
    return any(p in lower for p in VIDEO_PLATFORMS)

def looks_like_direct_image(url: str) -> bool:
    if not url:
        return False
    # Strip query/hash
    path = re.split(r'[?#]', url)[0]
    _, ext = os.path.splitext(path)
    return ext.lower() in DIRECT_IMAGE_EXTENSIONS

def download_direct_image(url: str, output_base: str, uncompressed=False):
    """Download a direct image URL (non Google Drive). Convert to AVIF unless --uncompressed.
    Returns True on success."""
    try:
        response = requests.get(url, stream=True, timeout=30)
        if response.status_code != 200:
            log_failure(f"Direct image download failed HTTP {response.status_code}: {url}")
            return False
        # Determine extension from URL first
        raw_path = output_base
        base_no_ext, _ = os.path.splitext(output_base)
        # If caller passed .avif path, we will create temp original if converting
        # Ensure parent
        os.makedirs(os.path.dirname(output_base), exist_ok=True)
        # Guess ext from URL or headers
        path_part = re.split(r'[?#]', url)[0]
        _, ext = os.path.splitext(path_part)
        if not ext or ext.lower() not in DIRECT_IMAGE_EXTENSIONS:
            ext = get_file_extension_from_headers(response.headers)
        if ext == '.bin':
            # Try to refine using content-type again; if still bin default to .jpg to let Pillow attempt
            ext = '.jpg'
        raw_original = base_no_ext + ext
        with open(raw_original, 'wb') as f:
            for chunk in response.iter_content(8192):
                if chunk:
                    f.write(chunk)
        print(f"✓ Direct downloaded: {raw_original}")
        if uncompressed:
            # If uncompressed and target is .avif, just leave original file; don't rename.
            return True
        # Convert if not already avif
        if ext.lower() == '.pdf':
            avif_path = convert_pdf_to_avif(raw_original)
            return bool(avif_path)
        if ext.lower() != '.avif':
            avif_path = convert_to_avif_high_quality(raw_original)
            return bool(avif_path)
        # Already avif
        return True
    except Exception as e:
        log_failure(f"Direct image exception {url}: {e}")
        return False


def extract_team_number(team_str):
    m = re.search(r'Team (\d+)', team_str)
    return m.group(1) if m else team_str.replace('Team ', '').strip()


def organize_files_from_csv(csv_path, out_dir='dist/image', uncompressed=False):
    if not os.path.exists(csv_path):
        print(f"✗ CSV not found: {csv_path}")
        return
    os.makedirs(out_dir, exist_ok=True)
    succ = fail = 0
    
    with open(csv_path, encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        headers = reader.fieldnames
        
        has_single_submission = 'Submission Image' in headers

        for row in reader:
            team_num = extract_team_number(row.get('Team Number', ''))
            if not team_num:
                continue

            team_dir = os.path.join(out_dir, team_num)
            os.makedirs(team_dir, exist_ok=True)
            print(f"\n📋 Team {team_num}: {row.get('Team Name','')}")

            if has_single_submission:
                url = row.get('Submission Image', '').strip()
                if url:
                    if is_video_platform(url):
                        print(f" ▶️ Skipping video URL (will embed by frontend): {url}")
                    else:
                        fid = extract_file_id_from_drive_url(url)
                        target = os.path.join(team_dir, 'Photo.avif')
                        if fid:
                            print(f" 📥 Downloading Photo (Google Drive)...")
                            if download_file_from_drive(fid, target, uncompressed):
                                succ += 1
                            else:
                                print(f" ✗ Failed Photo")
                                fail += 1
                        elif looks_like_direct_image(url):
                            print(f" 📥 Downloading Direct Image...")
                            if download_direct_image(url, target, uncompressed):
                                succ += 1
                            else:
                                print(f" ✗ Failed Direct Image")
                                fail += 1
                        else:
                            print(f" ⚠️ Unrecognized URL (not drive or direct image): {url}")
                            fail += 1
                else:
                    print(f" ⚠️ No URL for Photo")
            else:
                # Fallback to old logic
                for i in range(1, 5):
                    url = row.get(f'Submission Image {i}', '').strip()
                    if not url:
                        continue
                    fid = extract_file_id_from_drive_url(url)
                    if not fid:
                        print(f" ⚠️ Invalid URL for Photo {i}")
                        fail += 1
                        continue
                    target = os.path.join(team_dir, f'Photo{i}.avif')
                    print(f" 📥 Downloading Photo {i}...")
                    if download_file_from_drive(fid, target, uncompressed):
                        succ += 1
                    else:
                        print(f" ✗ Failed Photo {i}")
                        fail += 1
            time.sleep(1)
    print(f"\n📊 Completed: {succ} succeeded, {fail} failed")
    print(f"📁 Files in {os.path.abspath(out_dir)}")


if __name__ == "__main__":
    uncompressed = '--uncompressed' in sys.argv
    CSV_FILE = "data.csv"
    OUT_DIR = "public/image"
    OUT_PATH = Path(OUT_DIR)
    if OUT_PATH.exists():
        shutil.rmtree(OUT_PATH)
    OUT_PATH.mkdir(parents=True, exist_ok=True)

    print("🚀 Starting Organizer")
    if uncompressed:
        print("ℹ️ Skipping AVIF conversion (--uncompressed)")
    print("=" * 40)
    organize_files_from_csv(CSV_FILE, OUT_DIR, uncompressed)
    print("\n🎉 Done! Use --uncompressed to keep originals.")
