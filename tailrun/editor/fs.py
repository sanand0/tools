#!/usr/bin/env python3
"""Simple JSON-stdout filesystem commands; write accepts JSON on stdin with compare-and-swap."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import tempfile

MAX_TEXT = 1024 * 1024

# Windows subprocess stdout can default to cp1252/cp850. File names and file
# content must round-trip as UTF-8, even if the parent shell uses a legacy code page.
for stream in (sys.stdin, sys.stdout, sys.stderr):
    if hasattr(stream, 'reconfigure'):
        stream.reconfigure(encoding='utf-8')

def emit(**kw):
    print(json.dumps(kw, ensure_ascii=False))


def path_for(arg):
    return Path(arg).expanduser().resolve()


def encoding_and_text(raw):
    if b'\x00' in raw[:512] and not (raw.startswith(b'\xff\xfe') or raw.startswith(b'\xfe\xff')):
        raise ValueError('This looks like a binary file')
    for bom, enc in [(b'\xef\xbb\xbf', 'utf-8-sig'), (b'\xff\xfe', 'utf-16'), (b'\xfe\xff', 'utf-16')]:
        if raw.startswith(bom): return enc, raw.decode(enc)
    return 'utf-8', raw.decode('utf-8')


def roots():
    home = Path.home()
    out = [{'name': name, 'path': str(p)} for name,p in [('Home',home),('Code',home/'code'),('Downloads',home/'Downloads'),('Dropbox',home/'Dropbox')] if p.exists()]
    if os.name == 'nt':
        import ctypes
        bitmap = ctypes.windll.kernel32.GetLogicalDrives()
        out += [{'name': f'{chr(65+i)}:', 'path': f'{chr(65+i)}:\\'} for i in range(26) if bitmap & (1<<i)]
    else: out.append({'name':'/', 'path':'/'})
    emit(roots=out)


def listing(p):
    if not p.is_dir(): raise ValueError('Not a directory')
    rows = []
    for child in p.iterdir():
        try:
            s = child.stat()
            rows.append({'name':child.name,'path':str(child),'dir':child.is_dir(),'size':s.st_size,'mtime':s.st_mtime})
        except OSError: continue
    rows.sort(key=lambda x: (not x['dir'],x['name'].casefold()))
    emit(path=str(p),parent=str(p.parent),entries=rows[:500],truncated=len(rows)>500)


def read(p):
    if not p.is_file(): raise ValueError('Not a file')
    if p.stat().st_size > MAX_TEXT: raise ValueError('File too large for editor (1 MB max)')
    raw = p.read_bytes()
    enc, text = encoding_and_text(raw)
    emit(path=str(p), content=text, hash=hashlib.sha256(raw).hexdigest(), encoding=enc,
         newline='\r\n' if b'\r\n' in raw else '\n')


def write(p):
    payload = json.load(sys.stdin)
    content = payload['content']
    expected = payload.get('hash')
    if not isinstance(content,str) or len(content.encode('utf-8')) > MAX_TEXT: raise ValueError('Content must be text up to 1 MB')
    if p.exists():
        original = p.read_bytes()
        if hashlib.sha256(original).hexdigest() != expected: raise ValueError('File changed since opening; reload before saving')
        enc, _ = encoding_and_text(original)
        mode = stat.S_IMODE(p.stat().st_mode)
        newline = '\r\n' if b'\r\n' in original else '\n'
    else:
        if expected not in (None, ''): raise ValueError('File was deleted since opening')
        if not p.parent.is_dir(): raise ValueError('Parent folder does not exist')
        enc, mode, newline = 'utf-8', None, '\n'
    # Preserve original CRLF when a browser normalizes textarea newlines.
    if newline == '\r\n': content = content.replace('\r\n','\n').replace('\n','\r\n')
    raw = content.encode(enc)
    with tempfile.NamedTemporaryFile(prefix='.tailrun-', dir=p.parent, delete=False) as tmp:
        tmp.write(raw); temp = Path(tmp.name)
    try:
        if mode is not None: temp.chmod(mode)
        temp.replace(p)
    finally:
        temp.unlink(missing_ok=True)
    emit(saved=True, path=str(p), hash=hashlib.sha256(raw).hexdigest(), size=len(raw))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action',choices=['roots','list','read','write'])
    parser.add_argument('path', nargs='?', default='~')
    a = parser.parse_args()
    if a.action == 'roots': roots(); return
    p = path_for(a.path)
    if a.action == 'list': listing(p)
    elif a.action == 'read': read(p)
    elif a.action == 'write': write(p)


if __name__ == '__main__':
    try: main()
    except (OSError,UnicodeError,ValueError,KeyError,TypeError) as ex:
        emit(error=str(ex)); sys.exit(2)
