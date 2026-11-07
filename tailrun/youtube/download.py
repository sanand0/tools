#!/usr/bin/env python3
"""Download MP3, artwork and optional English captions into TAILRUN_JOB_DIR."""
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.parse import parse_qs, urlparse

def normalize(text):
    text = text.strip()
    if re.fullmatch(r'[\w-]{11}', text):
        return 'https://www.youtube.com/watch?v=' + text
    u = urlparse(text)
    if u.scheme != 'https' or (u.hostname or '').lower() not in {
        'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
        'youtu.be', 'www.youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com',
    }:
        raise ValueError('Enter a YouTube URL or 11-character video ID')
    host = (u.hostname or '').lower()
    parts = u.path.strip('/').split('/')
    if host.endswith('youtu.be'):
        ident = parts[0]
    elif parts[0] in ('shorts', 'live', 'embed') and len(parts) >= 2:
        ident = parts[1]
    else:
        ident = parse_qs(u.query).get('v', [''])[0]
    if not re.fullmatch(r'[\w-]{11}', ident):
        raise ValueError('Cannot find a valid YouTube video ID')
    return 'https://www.youtube.com/watch?v=' + ident

def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: download.py YOUTUBE_URL_OR_ID')
    url = normalize(sys.argv[1])
    output = Path(os.environ.get('TAILRUN_JOB_DIR', str(Path.home() / '.cache' / 'tailrun' / 'downloads')))
    output.mkdir(parents=True, exist_ok=True)
    base = [
        'uvx', '--with', 'mutagen', 'yt-dlp', '--remote-components', 'ejs:github',
        '--no-playlist', '--newline', '--paths', str(output),
        '-o', '%(title).150B [%(id)s].%(ext)s',
    ]
    print('Download:', url, flush=True)
    print('Output:', output, flush=True)
    audio = base + [
        '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '5',
        '--embed-thumbnail', '--embed-metadata', '--write-thumbnail', '--', url,
    ]
    result = subprocess.call(audio)
    if result != 0:
        return result
    if not list(output.glob('*.mp3')):
        print('No MP3 produced', file=sys.stderr, flush=True)
        return 1
    # Captions are optional. Never turn a successful MP3 into a failed job.
    print('Audio saved; trying English subtitles...', flush=True)
    captions = base + [
        '--skip-download', '--write-subs', '--write-auto-subs',
        '--sub-langs', 'en', '--convert-subs', 'srt', '--', url,
    ]
    try:
        rc = subprocess.call(captions, timeout=90)
        if rc:
            print('English subtitles unavailable; MP3 is ready.', flush=True)
    except subprocess.TimeoutExpired:
        print('Subtitle request timed out; MP3 is ready.', flush=True)
    retained = Path(os.environ.get('TAILRUN_DOWNLOAD_DIR', str(Path.home() / 'Dropbox' / 'COPY'))).expanduser()
    if retained.is_dir():
        for file in output.iterdir():
            if file.is_file() and file.suffix.lower() in ('.mp3', '.srt', '.webp', '.jpg', '.png'):
                try:
                    shutil.copy2(file, retained / file.name)
                    print('Saved to Dropbox:', retained / file.name, flush=True)
                except OSError as exc:
                    print('Could not retain file:', exc, file=sys.stderr, flush=True)
    else:
        print('Dropbox/COPY not found; outputs available from Tailrun job.', flush=True)
    return 0

if __name__ == '__main__':
    try: sys.exit(main())
    except ValueError as ex: sys.exit(str(ex))
