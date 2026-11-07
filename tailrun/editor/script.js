import '../ui.js';
import { storedRunner } from '../runner.js';
const runner = storedRunner(), $ = id => document.getElementById(id);
let opened = null, currentHash = null, lastSaved = '', currentDir = '~';
const cmd = (action, path) => ['uv','run','--script','tailrun/editor/fs.py',action,...(path ? [path] : [])];
async function runJSON(action, path, stdin) {
  let output = '', errors = '', exit;
  for await (const event of runner.run({argv:cmd(action,path),cwd:'~/code/tools',stdin,timeout:120})) {
    if(event.type === 'stdout') output += event.data;
    if(event.type === 'stderr') errors += event.data;
    if(event.type === 'exit') exit = event.code;
  }
  let data;
  try { data = JSON.parse(output); } catch { throw new Error(errors || output || 'No output'); }
  if(exit !== 0 || data.error) throw new Error(data.error || errors || `Process exited ${exit}`);
  return data;
}
function checkDirty() {return opened && $('content').value !== lastSaved;}
function guard() {return !checkDirty() || confirm('You have unsaved changes. Discard them?');}
function showError(e) { $('error').textContent = e?.message || String(e); }
function button(label, action, className = 'btn btn-sm btn-outline-secondary') {const b=document.createElement('button');b.type='button';b.className=className;b.textContent=label;b.addEventListener('click',action);return b;}
async function roots() {
  try { const r = await runJSON('roots'); $('roots').replaceChildren();
    for(const entry of r.roots) $('roots').append(button(entry.name,()=>navigate(entry.path)));
  } catch(e){showError(e);}
}
async function navigate(path, skipGuard = false) {
  if(!skipGuard && !guard()) return;
  $('error').textContent = '';
  try {
    const data = await runJSON('list',path); currentDir=data.path; $('path').value=data.path;
    $('items').replaceChildren();
    const parent=document.createElement('li'); parent.className='list-group-item p-0';
    parent.append(button('.. (parent folder)',()=>navigate(data.parent),'btn w-100 text-start border-0 rounded-0')); $('items').append(parent);
    for (const entry of data.entries) {
      const li=document.createElement('li'); li.className='list-group-item p-0';
      li.append(button(`${entry.dir ? '▸' : '  '} ${entry.name}`,()=>entry.dir ? navigate(entry.path) : read(entry.path),'btn w-100 text-start text-break border-0 rounded-0'));
      $('items').append(li);
    }
    if (data.truncated) {const notice=document.createElement('li'); notice.className='list-group-item text-secondary small'; notice.textContent='Only the first 500 entries are shown.'; $('items').append(notice);}
  } catch(e){ showError(e); }
}
async function read(path) {
  if (!guard()) return;
  $('error').textContent = '';
  try {
    const r = await runJSON('read',path);
    opened=r.path; currentHash=r.hash; lastSaved=r.content; $('content').value=r.content;
    $('filetitle').textContent=r.path; $('status').textContent=`${r.encoding} · ${r.newline==='\r\n'?'CRLF':'LF'}`;
    $('save').disabled=$('reload').disabled=false; $('path').value=r.path;
  } catch(e){showError(e);}
}
async function save() {
  if(!opened) return;
  $('error').textContent = '';
  try {
    const r = await runJSON('write',opened,JSON.stringify({content:$('content').value,hash:currentHash}));
    currentHash=r.hash; lastSaved=$('content').value; $('status').textContent=`Saved ${r.size} bytes`;
  } catch(e){showError(e);}
}
$('open').addEventListener('click',async()=>{
  const path=$('path').value;
  try { await navigate(path); if($('error').textContent) await read(path); } catch(e) {showError(e);}
});
$('path').addEventListener('keydown',ev=>{if(ev.key==='Enter')$('open').click();});
$('save').addEventListener('click',save);
$('reload').addEventListener('click',()=>opened&&read(opened));
$('new').addEventListener('click',()=>{if(!guard())return;opened=$('path').value;currentHash=null;lastSaved='';$('content').value='';$('filetitle').textContent=opened;$('save').disabled=$('reload').disabled=false;});
window.addEventListener('beforeunload',ev=>{if(checkDirty()){ev.preventDefault();ev.returnValue='';}});
$('connect').addEventListener('click', async () => { await roots(); await navigate('~',true); });
// Public static pages must not request private-network access without a user gesture.
// Chrome/Edge may ask for local network access on the first connection.
const privatePage = location.hostname.endsWith('.ts.net') || ['localhost','127.0.0.1'].includes(location.hostname);
if (privatePage) { roots(); navigate('~',true); }
else { $('status').textContent = 'Select Connect to browse your private runner. Set its URL on the Tailrun home page first.'; }
