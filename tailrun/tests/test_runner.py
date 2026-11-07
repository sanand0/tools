"""No-dependency integration checks. Run: python -m unittest discover -s tests -v"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]

class RunnerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.port = 17899
        env = os.environ.copy()
        env.update(TAILRUN_STORE=cls.tmp.name, TAILRUN_PORT=str(cls.port), TAILRUN_USERS='tester@example.com')
        env.pop('TAILRUN_DEV', None)
        cls.proc = subprocess.Popen([sys.executable, '-u', str(ROOT / 'runner.py'), '--port', str(cls.port)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
        cls.url = f'http://127.0.0.1:{cls.port}/run'
        for _ in range(50):
            try:
                urllib.request.urlopen(urllib.request.Request(cls.url, headers={'Tailscale-User-Login':'tester@example.com'}),timeout=1)
                return
            except Exception: time.sleep(.1)
        raise RuntimeError('Server did not start')

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate(); cls.proc.wait(timeout=5); cls.tmp.cleanup()

    def request(self, url=None, data=None, headers=None):
        h = {'Tailscale-User-Login':'tester@example.com', **(headers or {})}
        return urllib.request.urlopen(urllib.request.Request(url or self.url, data=data, headers=h), timeout=12)

    def test_auth(self):
        with self.assertRaises(urllib.error.HTTPError) as cm: urllib.request.urlopen(self.url)
        self.assertEqual(cm.exception.code,403)
        with self.assertRaises(urllib.error.HTTPError) as cm:
            self.request(headers={'Origin':'https://evil.example'})
        self.assertEqual(cm.exception.code,403)
        with self.request(headers={'Origin':'https://tools.s-anand.net'}) as r:
            self.assertEqual(r.headers['Access-Control-Allow-Origin'],'https://tools.s-anand.net')
        with self.request('http://127.0.0.1:17899/tailrun/') as r:
            page=r.read()
            self.assertIn(b'Tailrun',page)
            self.assertIn(b'<details id="recentJobs"',page)
            self.assertNotIn(b'<details id="recentJobs" open',page)

    def test_run_and_artifacts(self):
        snippet = "import os,sys;print('hello',flush=True);print('oops',file=sys.stderr,flush=True);open(os.environ['TAILRUN_JOB_DIR']+'/test.txt','w').write('done');open(os.environ['TAILRUN_JOB_DIR']+'/test.html','w').write('<script>alert(1)</script>')"
        payload = json.dumps({'argv':[sys.executable,'-u','-c',snippet],'timeout':5}).encode()
        with self.request(data=payload, headers={'Content-Type':'application/json','X-Tailrun-Request':'1'}) as r:
            events = [json.loads(x) for x in r.read().splitlines()]
        self.assertEqual(events[-1]['status'],'done')
        self.assertTrue(any(e['type']=='stdout' and 'hello' in e['data'] for e in events))
        self.assertTrue(any(e['type']=='stderr' and 'oops' in e['data'] for e in events))
        job_id = events[0]['id']
        with self.request(self.url+'?id='+job_id+'&meta=1') as r: info=json.load(r)
        self.assertEqual(info['status'],'done')
        with self.request(self.url+'?id='+job_id) as r: self.assertIn(b'"type": "exit"',r.read())
        with self.request(self.url+'?id='+job_id+'&file=test.txt') as r:
            self.assertEqual(r.read(),b'done')
            self.assertTrue(r.headers['Content-Disposition'].startswith('inline;'))
            self.assertEqual(r.headers['Content-Security-Policy'],'sandbox')
        with self.request(self.url+'?id='+job_id+'&file=test.txt&download=1') as r:
            self.assertTrue(r.headers['Content-Disposition'].startswith('attachment;'))
        with self.request(self.url+'?id='+job_id+'&file=test.html') as r:
            self.assertEqual(r.headers['Content-Type'],'text/plain; charset=utf-8')
            self.assertEqual(r.headers['Content-Security-Policy'],'sandbox')
        with self.assertRaises(urllib.error.HTTPError) as cm:
            self.request(self.url+'?id='+job_id+'&file=../meta.json')
        self.assertEqual(cm.exception.code,404)
        with self.request() as r: history=json.load(r)['jobs']
        self.assertIn(job_id,[j['id'] for j in history])

    def test_limit(self):
        store=Path(self.tmp.name)
        for i in range(110):
            job=store / ('a'*20+f'{i:04x}')
            job.mkdir(exist_ok=True)
            (job/'meta.json').write_text(json.dumps({'id':job.name,'created':f'2020-01-01T00:{i:02}:00','status':'done'}))
        with self.request() as r: items=json.load(r)['jobs']
        self.assertEqual(len(items),100)

if __name__ == '__main__': unittest.main()
