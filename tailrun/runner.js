/** Generic Tailrun client. No framework or build step. */
class Runner {
  constructor({ url = '' } = {}) {
    this.url = url;
  }
  requireBackend() {
    if (!this.url) throw new Error('Set your private runner URL on the Tailrun home page first.');
  }
  async json(url, init) {
    this.requireBackend();
    const response = await fetch(url, {cache: 'no-store', ...init});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    return result;
  }
  async history() { return (await this.json(this.url)).jobs; }
  async info(id) {
    const url = new URL(this.url); url.searchParams.set('id', id); url.searchParams.set('meta', '1');
    return this.json(url);
  }
  artifactUrl(id, name, { download = false } = {}) {
    this.requireBackend();
    const url = new URL(this.url); url.searchParams.set('id', id); url.searchParams.set('file', name);
    if (download) url.searchParams.set('download', '1');
    return url.href;
  }
  async *logs(id, { follow = false, signal } = {}) {
    const url = new URL(this.url); url.searchParams.set('id', id);
    if (follow) url.searchParams.set('follow', '1');
    yield* this.stream(url, { signal });
  }
  async *transcribe(file, { filename = '', prompt = '' } = {}, { signal } = {}) {
    this.requireBackend();
    const extension = /\.[^.]+$/.exec(file.name)?.[0]?.toLowerCase() || '';
    const api = new URL(this.url);
    api.pathname = api.pathname === '/tailrun/run' ? '/tailrun/upload' : '/transcribe';
    const url = api.href;
    yield* this.stream(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Tailrun-Request': '1',
        'X-Tailrun-Options': encodeURIComponent(JSON.stringify({filename, prompt, extension}))
      },
      body: file, signal
    });
  }
  async *run({ argv, cwd = '~', stdin, timeout = 600 }, { signal } = {}) {
    yield* this.stream(this.url, {
      method: 'POST', headers: {'Content-Type': 'application/json', 'X-Tailrun-Request': '1'},
      body: JSON.stringify({ argv, cwd, stdin, timeout }), signal,
    });
  }
  async *stream(url, init = {}) {
    this.requireBackend();
    const response = await fetch(url, { cache: 'no-store', ...init });
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try { message = (await response.json()).error || message; } catch { /* use HTTP error */ }
      throw new Error(message);
    }
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let pending = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        pending += decoder.decode(value || new Uint8Array(), { stream: !done });
        let ix;
        while ((ix = pending.indexOf('\n')) !== -1) {
          const line = pending.slice(0, ix); pending = pending.slice(ix + 1);
          if (line.trim()) yield JSON.parse(line);
        }
        if (done) break;
      }
      if (pending.trim()) yield JSON.parse(pending);
    } finally { reader.releaseLock(); }
  }
}

export {Runner};
export function storedRunner() {
  const privateHost = location.hostname.endsWith('.ts.net') || ['localhost','127.0.0.1'].includes(location.hostname);
  const url = localStorage.getItem('tailrun-url') || (privateHost ? new URL('/tailrun/run', location.origin).href : '');
  return new Runner({ url });
}
