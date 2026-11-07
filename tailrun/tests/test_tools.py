"""Filesystem and YouTube wrapper unit tests. No network access."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from youtube.download import normalize
from transcribe.workflow import opus_command, call_command

class ToolTests(unittest.TestCase):
    def test_youtube_ids(self):
        self.assertEqual(normalize('jNQXAC9IVRw'), 'https://www.youtube.com/watch?v=jNQXAC9IVRw')
        self.assertEqual(normalize('https://youtu.be/jNQXAC9IVRw?t=7'), 'https://www.youtube.com/watch?v=jNQXAC9IVRw')
        self.assertEqual(normalize('https://www.youtube.com/shorts/jNQXAC9IVRw'), 'https://www.youtube.com/watch?v=jNQXAC9IVRw')
        with self.assertRaises(ValueError): normalize('https://evil.example/jNQXAC9IVRw')

    def test_transcribe_commands_reuse_existing_settings(self):
        source = Path("input.mp4")
        result = Path("output.opus")
        args = opus_command(source, result)
        self.assertEqual(args[0], "ffmpeg")
        self.assertEqual(args[args.index("-b:a") + 1], "12k")
        self.assertEqual(args[args.index("-ac") + 1], "1")
        self.assertEqual(args[args.index("-application") + 1], "voip")
        self.assertEqual(args[args.index("-vbr") + 1], "on")
        self.assertEqual(args[args.index("-compression_level") + 1], "10")
        cmd = call_command(result, Path("out"), "")
        self.assertIn("--out", cmd)
        self.assertNotIn("--prompt", cmd)
        custom = call_command(result, Path("out"), "Transcribe the speakers")
        self.assertEqual(custom[-2:], ["--prompt", "Transcribe the speakers"])

    def test_editor_preserves_crlf_and_conflicts(self):
        program = ROOT / 'editor' / 'fs.py'
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'sample.txt'
            path.write_bytes(b'one\r\ntwo\r\n')
            def call(action, data=None):
                r = subprocess.run([sys.executable, str(program), action, str(path)],
                    input=json.dumps(data) if data is not None else None,
                    text=True, capture_output=True)
                return r.returncode, json.loads(r.stdout)
            code, read = call('read')
            self.assertEqual(code,0)
            self.assertEqual(read['newline'],'\r\n')
            code, saved = call('write',{'content':'updated\nagain','hash':read['hash']})
            self.assertEqual(code,0)
            self.assertEqual(path.read_bytes(),b'updated\r\nagain')
            code, conflict = call('write',{'content':'oops','hash':read['hash']})
            self.assertEqual(code,2)
            self.assertIn('changed',conflict['error'])

    def test_editor_unicode_paths_and_content_with_legacy_console_encoding(self):
        """Windows subprocesses may use cp1252, but paths and stdin require Unicode."""
        program = ROOT / 'editor' / 'fs.py'
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            path = directory / 'note：🌍.txt'
            path.write_text('Hello 🌍\n中文：success', encoding='utf-8')
            env = {**os.environ, 'PYTHONIOENCODING': 'cp1252'}
            def call(action, target, data=None):
                payload = json.dumps(data, ensure_ascii=False).encode('utf-8') if data is not None else None
                result = subprocess.run([sys.executable, str(program), action, str(target)],
                                        input=payload, capture_output=True, env=env)
                self.assertEqual(result.returncode, 0, result.stderr.decode('utf-8', errors='replace'))
                return json.loads(result.stdout.decode('utf-8'))
            items = call('list', directory)
            self.assertEqual([item['name'] for item in items['entries']], ['note：🌍.txt'])
            loaded = call('read', path)
            self.assertEqual(loaded['content'].replace('\r\n', '\n'), 'Hello 🌍\n中文：success')
            updated = call('write', path, {'content':'Changed 🐍：新', 'hash':loaded['hash']})
            self.assertTrue(updated['saved'])
            self.assertEqual(path.read_text(encoding='utf-8'), 'Changed 🐍：新')

if __name__ == '__main__': unittest.main()
