import './ui.js';
import {storedRunner} from './runner.js';

const $ = id => document.getElementById(id);
const list = $('history'), panel = $('recentJobs');
let runner = storedRunner();
let selected = new URLSearchParams(location.search).get('id');
const activeLogs = new Map();
$('server').value = runner.url;
$('backendStatus').textContent = runner.url
  ? 'Private job data loads only when you open Recent jobs.'
  : 'Set your runner URL to use the private tools.';

function el(tag, cls = '', text = null) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== null) node.textContent = text;
  return node;
}
function showError(message) {
  $('error').textContent = message ? String(message) : '';
  $('error').classList.toggle('d-none', !message);
}
function friendlyError(err) {
  return err instanceof TypeError && /fetch/i.test(err.message)
    ? 'Cannot reach the private runner. Check Tailscale, the URL, and access.'
    : (err?.message || String(err));
}
function shortDate(when) {
  return when ? new Date(when).toLocaleString(undefined, {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
}
function badge(status) {
  const shade = {done:'success',failed:'danger',running:'primary',queued:'warning',timeout:'danger',interrupted:'secondary'}[status] || 'secondary';
  return el('span', 'badge text-bg-' + shade, status || 'unknown');
}
function outputLinks(job) {
  const files = el('div', 'job-files mt-2');
  if (!job.artifacts?.length) {
    files.append(el('span','small text-secondary', ['queued','running'].includes(job.status)
      ? 'Files will appear when this job finishes.' : 'No output files.'));
  }
  for (const f of job.artifacts || []) {
    const item = el('span');
    const view = el('a','',f.name);
    view.href = runner.artifactUrl(job.id, f.name);
    view.target = '_blank';
    view.rel = 'noopener noreferrer';
    const size = el('span','file-size ms-1', '(' + (f.size / 1024).toFixed(1) + ' KB)');
    const save = el('a','small ms-2','Download');
    save.href = runner.artifactUrl(job.id, f.name, {download:true});
    item.append(view,size,save);
    files.append(item);
  }
  return files;
}
function select(id) {
  selected = id;
  history.replaceState(null,'', '?id=' + encodeURIComponent(id));
  for (const row of list.querySelectorAll('.job-row')) {
    row.classList.toggle('table-active',row.dataset.id === id);
  }
}
async function loadLogs(job, pre, detail, statusCell) {
  const controller = new AbortController();
  activeLogs.get(job.id)?.abort();
  activeLogs.set(job.id,controller);
  pre.textContent = '';
  try {
    const info = await runner.info(job.id);
    for await (const event of runner.logs(job.id,{
      follow:['queued','running'].includes(info.status),
      signal:controller.signal
    })) {
      if(['stdout','stderr','notice'].includes(event.type)) {
        pre.textContent += event.data || '';
        pre.scrollTop = pre.scrollHeight;
      }
      if(event.type === 'exit') {
        const updated = await runner.info(job.id);
        detail.querySelector('.job-files')?.replaceWith(outputLinks(updated));
        statusCell.replaceChildren(badge(updated.status));
      }
    }
  } catch(err) {
    if(err.name !== 'AbortError') pre.textContent += '\n' + friendlyError(err);
  } finally {
    if(activeLogs.get(job.id) === controller) activeLogs.delete(job.id);
  }
}
function makeRows(job) {
  const row = el('tr','job-row');
  row.dataset.id = job.id;
  if (job.id === selected) row.classList.add('table-active');
  const date = el('td','small text-secondary job-time', shortDate(job.created));
  const status = el('td','job-status'); status.append(badge(job.status));
  const cell = el('td','job-command-cell');
  const button = el('button','btn btn-link p-0 text-start text-decoration-none job-command-button',(job.argv || []).join(' '));
  button.type = 'button';
  button.title = (job.argv || []).join(' ');
  button.setAttribute('aria-expanded','false');
  button.setAttribute('aria-label','View output for job ' + job.id);
  cell.append(button);
  row.append(date,status,cell);

  const extra = el('tr','job-extra');
  extra.hidden = true;
  const content = el('td');
  content.colSpan = 3;
  const code = el('div','job-command');
  code.append(el('code','',(job.argv || []).join(' ')));
  const cwd = el('div','small text-secondary file-path',job.cwd || '');
  const heading = el('div','small fw-semibold mt-2','Outputs');
  const files = outputLinks(job);
  const logsHeading = el('div','small fw-semibold mt-3 mb-1','Logs');
  const pre = el('pre','job-log');
  content.append(code,cwd,heading,files,logsHeading,pre);
  extra.append(content);
  const toggle = () => {
    extra.hidden = !extra.hidden;
    button.setAttribute('aria-expanded',String(!extra.hidden));
    if (!extra.hidden) {
      select(job.id);
      loadLogs(job,pre,content,status);
    } else {
      activeLogs.get(job.id)?.abort();
      activeLogs.delete(job.id);
    }
  };
  button.addEventListener('click', toggle);
  if(job.id === selected) {
    extra.hidden = false;
    button.setAttribute('aria-expanded','true');
    loadLogs(job,pre,content,status);
  }
  return [row,extra];
}
async function refresh() {
  if(!panel.open) return;
  if(!runner.url) {
    $('historyStatus').textContent = 'Set a backend URL above, then try again.';
    return;
  }
  $('historyStatus').textContent = 'Loading private jobs…';
  try {
    const jobs = await runner.history();
    if(selected && !jobs.some(job => job.id === selected)) jobs.unshift(await runner.info(selected));
    for(const controller of activeLogs.values()) controller.abort();
    activeLogs.clear();
    const fragment = document.createDocumentFragment();
    for(const job of jobs) fragment.append(...makeRows(job));
    list.replaceChildren(fragment);
    $('count').textContent = jobs.length ? '(' + jobs.length + ')' : '';
    if(!jobs.length) {
      const tr=el('tr'); const td=el('td','text-secondary','No jobs yet.');
      td.colSpan=3; tr.append(td); list.append(tr);
    }
    $('historyStatus').textContent = '';
    showError('');
    if(selected) document.querySelector('.job-row.table-active')?.scrollIntoView({block:'nearest'});
  } catch(err) {
    $('historyStatus').textContent = '';
    showError(friendlyError(err));
  }
}
panel.addEventListener('toggle',()=>{
  if(panel.open) refresh();
  else {for(const c of activeLogs.values()) c.abort(); activeLogs.clear();}
});
$('refresh').addEventListener('click', refresh);
$('config').addEventListener('submit', e => {
  e.preventDefault();
  try {
    const raw = $('server').value.trim();
    if(raw) {
      const url = new URL(raw);
      if(!['https:','http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/run')
        throw new Error('Enter a full http(s) URL ending in /run.');
      if(url.protocol === 'http:' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname))
        throw new Error('Use HTTPS for a remote runner.');
      localStorage.setItem('tailrun-url',url.href);
    } else localStorage.removeItem('tailrun-url');
    runner = storedRunner(); selected = null;
    history.replaceState(null,'', location.pathname);
    $('backendStatus').textContent = runner.url ? 'Saved in this browser.' : 'No backend selected.';
    showError('');
    if(panel.open) refresh();
  } catch(err) {showError(err.message);}
});
if(selected) panel.open = true;
