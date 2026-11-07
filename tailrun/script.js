import './ui.js';
import { storedRunner } from './runner.js';

const $ = id => document.getElementById(id);
const list = $('history'), panel = $('recentJobs');
let runner = storedRunner();
let selected = new URLSearchParams(location.search).get('id');
let lastJobs = [];
const activeLogs = new Map();

$('server').value = runner.url;
$('backendStatus').textContent = runner.url ? 'Private job data loads only when you open Recent jobs.' : 'Set your runner URL to use the private tools.';

function element(tag, className = '', text = null) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== null) el.textContent = text;
  return el;
}
function showError(message) {
  $('error').textContent = message ? String(message) : '';
  $('error').classList.toggle('d-none', !message);
}
function prettyDate(value) { return value ? new Date(value).toLocaleString() : '—'; }
function friendlyError(err) {
  return err instanceof TypeError && /fetch/i.test(err.message)
    ? 'Cannot reach the private runner. Check Tailscale, the URL, and your access rights.'
    : (err?.message || String(err));
}
function badge(status) {
  const label = status || 'unknown';
  const style = {done:'success',failed:'danger',running:'primary',queued:'warning',timeout:'danger',interrupted:'secondary'}[label] || 'secondary';
  return element('span', `badge text-bg-${style}`, label);
}
function outputLinks(job) {
  const files = element('div','job-files mt-2');
  if (!job.artifacts?.length) {
    files.append(element('span','text-secondary small', ['running','queued'].includes(job.status) ? 'Files will appear when the job ends.' : 'No output files.'));
    return files;
  }
  for (const f of job.artifacts) {
    const item = element('span');
    const link = element('a', '', f.name);
    link.href = runner.artifactUrl(job.id,f.name);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = 'Open in a new tab';
    const size = element('span','file-size ms-1',`(${(f.size/1024).toFixed(1)} KB)`);
    const dl = element('a','small ms-2','Download');
    dl.href = runner.artifactUrl(job.id,f.name,{download:true});
    dl.title = `Download ${f.name}`;
    item.append(link,size,dl);
    files.append(item);
  }
  return files;
}
function jobCard(job) {
  const card = element('article',`card job-card ${job.id === selected ? 'selected' : ''}`);
  card.id = `job-${job.id}`;
  const body = element('div','card-body');
  const title = element('div','d-flex flex-wrap align-items-center gap-2 mb-2');
  const link = element('a','fw-semibold text-decoration-none',`Job ${job.id.slice(0,8)}`);
  link.href = `?id=${encodeURIComponent(job.id)}`;
  const time = element('span','job-time small text-secondary ms-md-auto',prettyDate(job.created));
  title.append(link,badge(job.status),time);
  if (job.exit_code !== null && job.exit_code !== undefined)
    title.append(element('span','small text-secondary',`Exit ${job.exit_code}`));
  const command = element('div','job-command');
  command.append(element('code','',(job.argv || []).join(' ')));
  const cwd = element('div','small text-secondary file-path mt-1',job.cwd || '');
  const label = element('div','small fw-semibold mt-3','Outputs');
  const outputs = outputLinks(job);
  const details = element('details','mt-3');
  const summary = element('summary','small text-primary','Show logs');
  const pre = element('pre','job-log mt-2');
  details.append(summary,pre);
  details.addEventListener('toggle',()=> {
    if (details.open) { select(job.id); loadLogs(job.id, pre, summary); }
    else { activeLogs.get(job.id)?.abort(); activeLogs.delete(job.id); summary.textContent='Show logs'; }
  });
  link.addEventListener('click',e=>{e.preventDefault(); details.open=!details.open; if(details.open) details.scrollIntoView({block:'nearest',behavior:'smooth'});});
  body.append(title,command,cwd,label,outputs,details);
  card.append(body);
  return card;
}
function select(id) {
  selected = id;
  history.replaceState(null, '', `?id=${encodeURIComponent(id)}`);
  for (const card of list.children) card.classList.toggle('selected',card.id===`job-${id}`);
}
async function loadLogs(id, pre, summary) {
  if(activeLogs.has(id)) return;
  const abort = new AbortController();
  activeLogs.set(id,abort);
  summary.textContent = 'Hide logs';
  pre.textContent = '';
  try {
    const job = await runner.info(id);
    for await (const event of runner.logs(id,{follow:['running','queued'].includes(job.status),signal:abort.signal})) {
      if(['stdout','stderr','notice'].includes(event.type)) {
        pre.textContent += event.data || '';
        pre.scrollTop = pre.scrollHeight;
      } else if(event.type==='exit') {
        // Refresh the card after the process exits, including its output links.
        const updated = await runner.info(id);
        const previous = lastJobs.findIndex(x=>x.id===id);
        if(previous!==-1) lastJobs[previous]=updated;
        const card=pre.closest('.job-card');
        if(card) {
          card.querySelector('.job-files')?.replaceWith(outputLinks(updated));
          card.querySelector('.badge')?.replaceWith(badge(updated.status));
        }
      }
    }
  } catch(err) {
    if (err.name !== 'AbortError') pre.textContent += `\nCould not load logs: ${friendlyError(err)}\n`;
  } finally { activeLogs.delete(id); }
}
function render(jobs) {
  for(const controller of activeLogs.values()) controller.abort();
  activeLogs.clear();
  lastJobs=jobs;
  const fragment=document.createDocumentFragment();
  for(const job of jobs) fragment.append(jobCard(job));
  list.replaceChildren(fragment);
  $('count').textContent = jobs.length ? `(${jobs.length})` : '';
  if (!jobs.length) list.append(element('p','text-secondary','No jobs yet.'));
}
async function refresh() {
  if(!panel.open) return;
  if(!runner.url) {
    $('historyStatus').textContent='Set a backend URL above, then try again.';
    return;
  }
  $('historyStatus').textContent='Loading private jobs…';
  try {
    const jobs=await runner.history();
    if(selected && !jobs.some(job=>job.id===selected)) jobs.unshift(await runner.info(selected));
    render(jobs);
    $('historyStatus').textContent='';
    showError('');
    if (selected) {
      const card=document.getElementById(`job-${selected}`);
      const details=card?.querySelector('details');
      if(details) {details.open=true; card.scrollIntoView({block:'nearest'});}
    }
  } catch(err) {
    $('historyStatus').textContent='';
    showError(friendlyError(err));
  }
}
panel.addEventListener('toggle',()=>{ if(panel.open) refresh(); else { for(const c of activeLogs.values()) c.abort(); activeLogs.clear(); }});
$('refresh').addEventListener('click',refresh);
$('config').addEventListener('submit', e => {
  e.preventDefault();
  try {
    const raw=$('server').value.trim();
    if(raw) {
      const url=new URL(raw);
      if(!['https:','http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/run')
        throw new Error('Enter a full http(s) URL ending in /run.');
      if(url.protocol==='http:' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname))
        throw new Error('Use HTTPS for a remote runner.');
      localStorage.setItem('tailrun-url',url.href);
    } else localStorage.removeItem('tailrun-url');
    runner=storedRunner(); selected=null;
    history.replaceState(null,'',location.pathname);
    $('backendStatus').textContent=runner.url?'Saved in this browser.':'No backend selected.';
    showError('');
    if(panel.open) refresh();
  } catch(err) { showError(err.message); }
});
if(selected) panel.open=true;
