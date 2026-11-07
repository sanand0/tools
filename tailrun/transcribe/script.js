import '../ui.js';
import {storedRunner} from '../runner.js';
const $ = id => document.getElementById(id);
const runner = storedRunner();
function error(message) {
  $('error').textContent = message || '';
  $('error').classList.toggle('d-none', !message);
}
function showFiles(id, files) {
  $('files').replaceChildren();
  for (const f of files) {
    const row = document.createElement('div');
    row.className = 'card card-body py-2 d-flex flex-row gap-3 align-items-center flex-wrap';
    const open = document.createElement('a');
    open.href = runner.artifactUrl(id, f.name);
    open.target = '_blank'; open.rel = 'noopener noreferrer'; open.textContent = f.name;
    const save = document.createElement('a');
    save.href = runner.artifactUrl(id, f.name, {download: true});
    save.className = 'ms-auto small'; save.textContent = 'Download';
    row.append(open, save); $('files').append(row);
  }
}
$('form').addEventListener('submit', async event => {
  event.preventDefault();
  const file = $('audio').files[0];
  if (!file) return;
  error(''); $('files').replaceChildren(); $('logs').textContent = '';
  $('go').disabled = true; $('log-panel').open = true;
  $('status').textContent = 'Uploading file…';
  let jobId = '';
  try {
    for await (const item of runner.transcribe(file, {filename: $('filename').value.trim(), prompt: $('prompt').value.trim()})) {
      if (item.type === 'start') {
        jobId = item.id;
        $('status').textContent = 'Processing… ';
        const link = document.createElement('a');
        link.href = `../?id=${encodeURIComponent(jobId)}`;
        link.textContent = 'View job'; $('status').append(link);
      }
      if (['stdout','stderr','notice'].includes(item.type)) {
        $('logs').textContent += item.data || '';
        $('logs').scrollTop = $('logs').scrollHeight;
      }
      if (item.type === 'exit') {
        $('status').textContent = item.status === 'done' ? 'Transcript ready.' : 'Job ended: ' + item.status;
        if (item.status !== 'done') error('Transcription did not finish. See the process log.');
        showFiles(jobId, item.artifacts || []);
      }
    }
  } catch(e) {
    error(e.message);
    if (jobId) $('status').textContent = `The job may still be running. See job ${jobId} in Recent jobs.`;
  } finally { $('go').disabled = false; }
});