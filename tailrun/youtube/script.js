import '../ui.js';
import { storedRunner } from '../runner.js';

const runner = storedRunner(), $ = id => document.getElementById(id);
const previous = new URLSearchParams(location.search).get('url');
if (previous) $('video').value = previous;
$('form').addEventListener('submit', async event => {
  event.preventDefault();
  $('go').disabled = true;
  $('files').replaceChildren();
  $('logs').textContent = '';
  $('error').textContent = '';
  $('logPanel').open = true;
  $('status').textContent = 'Starting download…';
  let id;
  try {
    if (!runner.url) throw new Error('Set a backend URL on the Tailrun home page first.');
    const url = $('video').value.trim();
    for await (const ev of runner.run({
      argv: ['uv','run','--script','tailrun/youtube/download.py',url],
      cwd:'~/code/tools', timeout:900,
    })) {
      if(ev.type === 'start') {
        id = ev.id;
        const a = document.createElement('a');
        a.href = `../?id=${encodeURIComponent(id)}`;
        a.textContent = `View job ${id.slice(0,8)}`;
        $('status').replaceChildren(a);
      }
      if(['stdout','stderr','notice'].includes(ev.type)) {
        $('logs').textContent += ev.data || '';
        $('logs').scrollTop = $('logs').scrollHeight;
      }
      if(ev.type === 'exit') {
        $('status').textContent = `${ev.status} · exit ${ev.code} · `;
        if (id) {
          const a = document.createElement('a'); a.href=`../?id=${encodeURIComponent(id)}`; a.textContent='View job and logs';
          $('status').append(a);
        }
        if(ev.status !== 'done') $('error').textContent = 'Download failed. See process output.';
        for(const f of ev.artifacts || []) {
          const line = document.createElement('div');
          line.className = 'card card-body py-2 d-flex flex-row gap-3 align-items-center flex-wrap';
          const a = document.createElement('a');
          a.href = runner.artifactUrl(id,f.name);
          a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = f.name;
          a.title='Open in a new browser tab';
          const save = document.createElement('a');
          save.href=runner.artifactUrl(id,f.name,{download:true});
          save.className='small ms-auto'; save.textContent='Download';
          line.append(a,save); $('files').append(line);
        }
      }
    }
  } catch(err) {
    $('error').textContent = err.message;
    if(id) $('status').textContent = `The download may still be running. Check job ${id}.`;
  } finally { $('go').disabled = false; }
});
