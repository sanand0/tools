#!/usr/bin/env python3
"""Tailrun: private, streaming subprocess runner. No third-party dependencies."""
import argparse
import datetime as dt
import json
import mimetypes
import os
import re
from pathlib import Path
import sys
import secrets
import shutil
import signal
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlsplit

BASE = Path(__file__).resolve().parent
STORE = Path(os.environ.get('TAILRUN_STORE', str(Path.home() / '.cache' / 'tailrun' / 'jobs')))
PORT = int(os.environ.get('TAILRUN_PORT', '8767'))
HOST = os.environ.get('TAILRUN_HOST', '127.0.0.1')
USERS = {s.strip().lower() for s in os.environ.get('TAILRUN_USERS', '').split(',') if s.strip()}
ORIGINS = {s.strip().rstrip('/') for s in os.environ.get('TAILRUN_ORIGINS', 'https://tools.s-anand.net').split(',') if s.strip()}
DEV = os.environ.get('TAILRUN_DEV') == '1'  # Only for loopback tests; never in production.
MAX_ACTIVE = 2
MAX_LOG_BYTES = 4 * 1024 * 1024
MAX_STDIN = 1024 * 1024
MAX_UPLOAD = 1024 * 1024 * 1024
UPLOAD_EXTS = {'.mp3','.m4a','.aac','.mp4','.mkv','.mov','.webm','.wav','.flac','.opus','.ogg','.oga','.3gp','.wma'}
MAX_ARTIFACT = 500 * 1024 * 1024
MAX_JOBS = 100
ACTIVE = threading.BoundedSemaphore(MAX_ACTIVE)
LOCK = threading.RLock()


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='microseconds')


def location(job_id):
    if not (len(job_id) == 24 and all(c in '0123456789abcdef' for c in job_id)):
        raise ValueError('Invalid job ID')
    return STORE / job_id


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    with LOCK:
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
        tmp.replace(path)


def load(job_id):
    try:
        return json.loads((location(job_id) / 'meta.json').read_text(encoding='utf-8'))
    except (ValueError, FileNotFoundError, json.JSONDecodeError):
        return None


def latest():
    jobs = []
    for path in STORE.glob('*/meta.json'):
        try:
            item = json.loads(path.read_text(encoding='utf-8'))
            jobs.append(item)
        except (OSError, ValueError):
            continue
    return sorted(jobs, key=lambda x: x.get('created', ''), reverse=True)[:MAX_JOBS]


def events(job_id, follow=False):
    path = location(job_id) / 'events.ndjson'
    offset = 0
    while True:
        if path.exists():
            with path.open('rb') as fh:
                fh.seek(offset)
                for line in fh:
                    offset += len(line)
                    yield line
        item = load(job_id)
        if not follow or not item or item.get('status') in ('done', 'failed', 'timeout', 'interrupted'):
            break
        time.sleep(0.25)


def execute(job_id, argv, cwd, stdin, timeout):
    folder = location(job_id)
    meta = load(job_id)
    with ACTIVE:
        meta.update(status='running', started=now())
        write_json(folder / 'meta.json', meta)
        env = os.environ.copy()
        env['TAILRUN_JOB_DIR'] = str(folder)
        env['PYTHONUNBUFFERED'] = '1'
        # Windows legacy console code pages cannot encode all Unicode file names.
        env['PYTHONIOENCODING'] = 'utf-8'
        flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
        record_lock = threading.Lock()
        written = [0]
        def emit(event):
            line = (json.dumps(event, ensure_ascii=False) + '\n').encode('utf-8')
            with record_lock:
                if event.get('type') != 'exit' and written[0] + len(line) > MAX_LOG_BYTES:
                    if written[0] <= MAX_LOG_BYTES:
                        msg = b'{"type":"notice","data":"Log limit reached; subsequent output discarded"}\n'
                        with (folder / 'events.ndjson').open('ab') as fh:
                            fh.write(msg)
                    written[0] = MAX_LOG_BYTES + 1
                    return
                with (folder / 'events.ndjson').open('ab') as fh:
                    fh.write(line)
                written[0] += len(line)
        emit({'type': 'start', 'id': job_id, 'at': now()})
        proc = None
        started = time.monotonic()
        status, code = 'failed', None
        try:
            proc = subprocess.Popen(argv, cwd=cwd, env=env, stdin=subprocess.PIPE if stdin is not None else subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=False, creationflags=flags, start_new_session=(os.name != 'nt'))
            def drain(source, handle):
                for chunk in iter(lambda: handle.read1(4096), b''):
                    if chunk:
                        emit({'type': source, 'data': chunk.decode('utf-8', errors='replace')})
                handle.close()
            threads = [threading.Thread(target=drain, args=(stream, handle), daemon=True) for stream, handle in [('stdout', proc.stdout), ('stderr', proc.stderr)]]
            for th in threads: th.start()
            # Feed stdin concurrently so a child that never reads it cannot block timeouts.
            feeder = None
            if stdin is not None:
                def feed_stdin():
                    try:
                        proc.stdin.write(stdin.encode('utf-8'))
                        proc.stdin.close()
                    except (BrokenPipeError, OSError):
                        pass
                feeder = threading.Thread(target=feed_stdin, daemon=True)
                feeder.start()
            try:
                code = proc.wait(timeout=timeout)
                status = 'done' if code == 0 else 'failed'
            except subprocess.TimeoutExpired:
                status = 'timeout'
                if os.name == 'nt':
                    subprocess.run(['taskkill', '/PID', str(proc.pid), '/T', '/F'], capture_output=True, timeout=15)
                else:
                    os.killpg(proc.pid, signal.SIGKILL)
                code = proc.wait(timeout=15)
            for th in threads: th.join(timeout=5)
            if feeder: feeder.join(timeout=1)
        except Exception as exc:
            emit({'type': 'stderr', 'data': f'{type(exc).__name__}: {exc}\n'})
            if proc and proc.poll() is None:
                proc.kill()
        artifacts = []
        for f in folder.iterdir():
            if f.is_file() and f.name not in ('events.ndjson', 'meta.json', 'meta.json.tmp') and f.stat().st_size <= MAX_ARTIFACT:
                artifacts.append({'name': f.name, 'size': f.stat().st_size})
        meta.update(status=status, exit_code=code, finished=now(), duration=round(time.monotonic() - started, 2), artifacts=artifacts)
        emit({'type': 'exit', 'status': status, 'code': code, 'duration': meta['duration'], 'artifacts': artifacts})
        write_json(folder / 'meta.json', meta)


def recover():
    STORE.mkdir(parents=True, exist_ok=True)
    for job in latest():
        if job.get('status') in ('running', 'queued'):
            job.update(status='interrupted', finished=now())
            write_json(location(job['id']) / 'meta.json', job)


class Handler(BaseHTTPRequestHandler):
    server_version = 'Tailrun/0.1'
    protocol_version = 'HTTP/1.1'

    def log_message(self, format, *args):
        print('%s - %s' % (self.address_string(), format % args), flush=True)

    def allowed_origin(self):
        origin = self.headers.get('Origin', '').rstrip('/')
        return not origin or origin == self.origin_self() or origin in ORIGINS

    def origin_self(self):
        proto = 'https' if self.headers.get('Tailscale-User-Login') else 'http'
        return f'{proto}://{self.headers.get("Host", "")}'

    def authorized(self):
        if not self.allowed_origin():
            self.error(403, 'Origin not allowed')
            return False
        if DEV and self.client_address[0] in ('127.0.0.1', '::1'):
            return True
        identity = self.headers.get('Tailscale-User-Login', '').strip().lower()
        if not identity or identity not in USERS:
            self.error(403, 'Tailscale user not authorized')
            return False
        return True

    def headers_base(self, code, kind='application/json; charset=utf-8', length=None, download=None, inline=False):
        self.send_response(code)
        self.send_header('Content-Type', kind)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'no-store')
        csp = ('sandbox' if inline else
               "default-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
               "font-src 'self' https://cdn.jsdelivr.net data:; script-src 'self'; "
               "connect-src 'self' https://*.ts.net:*;")
        self.send_header('Content-Security-Policy', csp)
        origin = self.headers.get('Origin', '').rstrip('/')
        if origin and origin in ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        if length is not None: self.send_header('Content-Length', str(length))
        if download:
            safe_name = ''.join(c if c.isascii() and (c.isalnum() or c in '._-') else '_' for c in download)
            mode = 'inline' if inline else 'attachment'
            self.send_header('Content-Disposition', f'{mode}; filename="{safe_name}"')
        self.end_headers()

    def result(self, data, code=200):
        buf = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.headers_base(code, length=len(buf))
        self.wfile.write(buf)

    def error(self, code, message):
        self.result({'error': message}, code)

    def do_OPTIONS(self):
        if not self.allowed_origin():
            return self.error(403, 'Origin not allowed')
        self.send_response(204)
        origin = self.headers.get('Origin', '').rstrip('/')
        if origin and origin in ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Tailrun-Request, X-Tailrun-Options')
            self.send_header('Vary', 'Origin')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        if not self.authorized(): return
        url = urlsplit(self.path)
        q = parse_qs(url.query)
        if url.path == '/run':
            job_id = q.get('id', [None])[0]
            if not job_id:
                return self.result({'jobs': latest(), 'limit': MAX_JOBS})
            job = load(job_id)
            if not job: return self.error(404, 'Job not found')
            if q.get('file'):
                name = q['file'][0]
                if name not in [a['name'] for a in job.get('artifacts', [])]:
                    return self.error(404, 'Artifact not found')
                p = location(job_id) / name
                if p.is_symlink() or not p.is_file() or p.resolve().parent != location(job_id).resolve():
                    return self.error(404, 'Artifact not found')
                kind = mimetypes.guess_type(name)[0] or 'application/octet-stream'
                # Prevent output HTML/SVG/XML from executing script in the /run origin.
                if kind in ('text/html', 'image/svg+xml', 'application/xml', 'text/xml', 'application/xhtml+xml'):
                    kind = 'text/plain; charset=utf-8'
                inline = q.get('download', ['0'])[0] != '1'
                self.headers_base(200, kind, p.stat().st_size, download=name, inline=inline)
                with p.open('rb') as fh:
                    shutil.copyfileobj(fh, self.wfile)
                return
            if q.get('meta'): return self.result(job)
            return self.stream(events(job_id, follow=q.get('follow', ['0'])[0] == '1'))
        if url.path == '/tailrun':
            self.send_response(308); self.send_header('Location', '/tailrun/'); self.send_header('Content-Length', '0'); self.end_headers(); return
        if url.path.startswith('/tailrun/'):
            relative = url.path[len('/tailrun/'):]
            if not relative or relative.endswith('/'):
                relative += 'index.html'
            candidate = (BASE / relative).resolve()
            if BASE.resolve() not in candidate.parents or not candidate.is_file() or candidate.is_symlink() or candidate.suffix.lower() not in ('.html', '.js', '.css', '.svg', '.json', '.webmanifest'):
                return self.error(404, 'Not found')
            kind = mimetypes.guess_type(candidate.name)[0] or 'application/octet-stream'
            self.headers_base(200, kind, candidate.stat().st_size)
            with candidate.open('rb') as fh: shutil.copyfileobj(fh, self.wfile)
            return
        return self.error(404, 'Not found')

    def stream(self, iterator):
        self.send_response(200)
        self.send_header('Content-Type', 'application/x-ndjson; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Transfer-Encoding', 'chunked')
        origin = self.headers.get('Origin', '').rstrip('/')
        if origin in ORIGINS: self.send_header('Access-Control-Allow-Origin', origin)
        self.end_headers()
        try:
            for line in iterator:
                self.wfile.write(f'{len(line):X}\r\n'.encode() + line + b'\r\n')
                self.wfile.flush()
            self.wfile.write(b'0\r\n\r\n'); self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError): pass

    def upload_transcribe(self):
        """Stream a file into a job and run the existing call workflow."""
        if (self.headers.get('Content-Type', '').split(';')[0] != 'application/octet-stream'
                or self.headers.get('X-Tailrun-Request') != '1'):
            return self.error(415, 'Requires application/octet-stream and X-Tailrun-Request: 1')
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= MAX_UPLOAD:
                raise ValueError('File must be between 1 byte and 1 GB')
            encoded = self.headers.get('X-Tailrun-Options', '')
            if len(encoded) > 12000:
                raise ValueError('Options too long')
            options = json.loads(unquote(encoded))
            if not isinstance(options, dict):
                raise ValueError('Options must be a JSON object')
            extension = options.get('extension', '')
            if not isinstance(extension, str) or extension.lower() not in UPLOAD_EXTS:
                raise ValueError('Unsupported audio/video extension')
            prompt = options.get('prompt', '')
            if not isinstance(prompt, str) or len(prompt) > 4000:
                raise ValueError('Prompt must be 4000 characters or less')
            stem = options.get('filename', '')
            if not isinstance(stem, str):
                raise ValueError('Invalid filename')
            stem = stem.strip() or dt.datetime.now().strftime('%Y-%m-%d %H-%M-%S')
            if not (1 <= len(stem) <= 100 and stem not in ('.', '..')
                    and stem == stem.strip('. ')
                    and not re.search(r'[<>:"/\\|?*\x00-\x1f]', stem)
                    and not stem.lower().endswith(('.opus', '.md'))):
                raise ValueError('Filename must be a plain name without a path or extension')
            if sum(j.get('status') in ('queued', 'running') for j in latest()) >= 10:
                return self.error(429, 'Too many queued jobs')
        except (ValueError, TypeError, json.JSONDecodeError) as ex:
            return self.error(400, str(ex))
        job_id = secrets.token_hex(12)
        folder = location(job_id)
        source = folder / 'work' / ('upload' + extension.lower())
        try:
            source.parent.mkdir(parents=True)
            with source.open('wb') as dest:
                remaining = size
                while remaining:
                    chunk = self.rfile.read(min(1024 * 1024, remaining))
                    if not chunk:
                        raise ConnectionError('Upload stopped before the file was complete')
                    dest.write(chunk)
                    remaining -= len(chunk)
        except (OSError, ConnectionError):
            shutil.rmtree(folder, ignore_errors=True)
            return self.error(400, 'Upload did not finish')
        (folder / 'events.ndjson').touch()
        argv = [sys.executable, '-u', str(BASE / 'transcribe' / 'workflow.py'),
                str(source), stem, '--prompt', prompt]
        meta = {'id': job_id, 'argv': argv, 'cwd': str(BASE), 'created': now(),
                'started': None, 'finished': None, 'duration': None, 'status': 'queued',
                'exit_code': None, 'artifacts': [], 'task': 'transcribe',
                'output_name': stem, 'upload_bytes': size}
        write_json(folder / 'meta.json', meta)
        threading.Thread(target=execute, args=(job_id, argv, str(BASE), None, 3600),
                         daemon=True).start()
        return self.stream(events(job_id, follow=True))

    def do_POST(self):
        if not self.authorized(): return
        if urlsplit(self.path).path == '/transcribe':
            return self.upload_transcribe()
        if urlsplit(self.path).path != '/run': return self.error(404, 'Not found')
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json' or self.headers.get('X-Tailrun-Request') != '1':
            return self.error(415, 'Requires application/json and X-Tailrun-Request: 1')
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not (0 < size <= MAX_STDIN + 65536): raise ValueError('Request too large or missing')
            data = json.loads(self.rfile.read(size))
            argv = data['argv']
            if not (isinstance(argv, list) and 1 <= len(argv) <= 100 and all(isinstance(s, str) and s and len(s) <= 8192 for s in argv)):
                raise ValueError('argv must be an array of strings')
            stdin = data.get('stdin')
            if stdin is not None and (not isinstance(stdin, str) or len(stdin.encode('utf-8')) > MAX_STDIN): raise ValueError('stdin too large')
            timeout = int(data.get('timeout', 600))
            if timeout < 1 or timeout > 3600: raise ValueError('timeout must be 1..3600')
            cwd = str(Path(data.get('cwd') or Path.home()).expanduser().resolve())
            if not Path(cwd).is_dir(): raise ValueError('cwd does not exist')
        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as ex:
            return self.error(400, str(ex))
        queued = sum(job.get('status') in ('queued', 'running') for job in latest())
        if queued >= 10: return self.error(429, 'Too many queued jobs')
        job_id = secrets.token_hex(12)
        folder = location(job_id)
        folder.mkdir(parents=True)
        (folder / 'events.ndjson').touch()
        meta = {'id': job_id, 'argv': argv, 'cwd': cwd, 'created': now(), 'started': None, 'finished': None, 'duration': None, 'status': 'queued', 'exit_code': None, 'artifacts': []}
        write_json(folder / 'meta.json', meta)
        threading.Thread(target=execute, args=(job_id, argv, cwd, stdin, timeout), daemon=True).start()
        return self.stream(events(job_id, follow=True))


def main():
    parser = argparse.ArgumentParser(description='Private Tailscale subprocess runner')
    parser.add_argument('--port', type=int, default=PORT)
    parser.add_argument('--host', default=HOST)
    args = parser.parse_args()
    if args.host not in ('127.0.0.1', '::1'):
        parser.error('Tailrun must bind to loopback only; use Tailscale Serve for remote access')
    recover()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f'Tailrun listening at http://{args.host}:{args.port}; dev={DEV}, users={len(USERS)}', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
