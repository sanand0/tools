import { describe, it, expect, vi } from 'vitest';
import { loadFrom } from '../common/testutils.js';

async function until(assertion) {
  let last;
  for (let i = 0; i < 30; i++) {
    try { assertion(); return; }
    catch (error) { last = error; await new Promise(resolve => setTimeout(resolve, 20)); }
  }
  throw last;
}
const job = {
  id: '0123456789abcdef01234567',
  created: '2026-11-07T01:00:00Z',
  status: 'done',
  cwd: 'C:\\code\\tools',
  argv: ['uv', 'run', '--script', 'download.py', 'link'],
  exit_code: 0,
  artifacts: [{name:'audio.mp3',size:12345},{name:'captions.srt',size:211}],
};
describe('Tailrun static frontend', () => {
  it('shows an explanation and backend before private, collapsed history', async () => {
    const { document } = await loadFrom(import.meta.dirname);
    expect(document.querySelector('header').textContent).toContain('Run commands from your browser');
    expect(document.getElementById('recentJobs').open).toBe(false);
    expect(document.getElementById('config').compareDocumentPosition(document.getElementById('recentJobs')) & 4).toBe(4);
    expect(document.getElementById('history').children.length).toBe(0);
    const tools = document.getElementById('tools');
    const cards = [...tools.querySelectorAll('a.tool-card')];
    expect(cards).toHaveLength(2);
    expect(cards.map(card => card.getAttribute('href'))).toEqual(['youtube/', 'editor/']);
    expect(cards.map(card => card.querySelector('h3').textContent)).toEqual(['Download YouTube audio', 'Edit text files']);
    expect(tools.classList.contains('mb-4')).toBe(true);
    expect(document.getElementById('config').compareDocumentPosition(tools) & 4).toBe(4);
    expect(tools.compareDocumentPosition(document.getElementById('recentJobs')) & 4).toBe(4);
  });
  it('renders one full-width card per job, with outputs below the command and inline links', async () => {
    const { document, window } = await loadFrom(import.meta.dirname);
    const requests = [];
    window.fetch = vi.fn(async url => {
      requests.push(String(url));
      return {ok:true, json:async()=>({jobs:[job]})};
    });
    const config = document.getElementById('config');
    document.getElementById('server').value='https://example.ts.net:8443/run';
    config.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
    expect(window.fetch).not.toHaveBeenCalled();
    const panel = document.getElementById('recentJobs');
    panel.open=true;
    panel.dispatchEvent(new window.Event('toggle'));
    await until(()=>expect(document.querySelectorAll('.job-card').length).toBe(1));
    expect(requests.some(url => url.endsWith('/run'))).toBe(true);
    const card = document.querySelector('.job-card');
    expect(card.classList.contains('card')).toBe(true);
    const command = card.querySelector('.job-command');
    const outputs = card.querySelector('.job-files');
    expect(command.compareDocumentPosition(outputs) & 4).toBe(4);
    const open = outputs.querySelector('a');
    expect(open.getAttribute('target')).toBe('_blank');
    expect(open.getAttribute('download')).toBe(null);
    expect(open.href).not.toContain('download=1');
    expect(outputs.querySelector('a[href*="download=1"]')).not.toBeNull();
  });
  it('uses the same tool styling on the editor and YouTube pages', async () => {
    for (const page of ['youtube','editor']) {
      const { document } = await loadFrom(import.meta.dirname, `${page}/index.html`);
      expect(document.querySelector('.navbar-brand').textContent).toContain('Tailrun');
      expect(document.querySelector('link[href="../style.css"]')).not.toBeNull();
      expect(document.querySelector('main.container')).not.toBeNull();
    }
  });
});
