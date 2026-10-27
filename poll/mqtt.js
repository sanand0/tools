// @ts-check
// Minimal MQTT 3.1.1 over WebSocket (QoS 0). Adapted from github.com/sanand0/mobile-games shared/mqtt.js.
// Works in browsers and Node >= 22 (global WebSocket). Public brokers: anyone can read/write any topic,
// so never send secrets and authenticate presenter messages separately (see signing.js).

export const BROKERS = ["wss://broker.emqx.io:8084/mqtt", "wss://test.mosquitto.org:8081"];
const enc = new TextEncoder(), dec = new TextDecoder();
const bytes = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};
const field = (s) => { const b = enc.encode(s); return bytes(Uint8Array.of(b.length >>> 8, b.length & 255), b); };
const frame = (type, payload) => {
  let v = payload.length; const len = [];
  do { let b = v % 128; v = Math.floor(v / 128); if (v) b |= 128; len.push(b); } while (v);
  return bytes(Uint8Array.of(type, ...len), payload);
};

/**
 * Reconnecting MQTT client. Subscriptions survive reconnects.
 * Status is one of "connecting" | "live" | "reconnecting" | "closed".
 */
export class MqttClient {
  /** @param {{brokerIndex?:number, brokers?:string[], prefix?:string, onMessage?:(topic:string, data:any)=>void, onStatus?:(status:string, detail?:string)=>void, onLive?:()=>void, maxBytes?:number}} options */
  constructor({ brokerIndex = 0, brokers = BROKERS, prefix = "poll", onMessage = () => {}, onStatus = () => {}, onLive = () => {}, maxBytes = 16000 } = {}) {
    Object.assign(this, { brokers, brokerIndex, onMessage, onStatus, onLive, maxBytes });
    this.clientId = `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
    /** @type {Set<string>} */ this.topics = new Set();
    /** @type {WebSocket|null} */ this.socket = null;
    this.live = false; this.stopped = true; this.attempt = 0; this.packetId = 1; this.everLive = false;
    this.sent = 0; this.received = 0;
  }

  get broker() { return this.brokers[this.brokerIndex]; }

  connect() {
    this.stopped = false;
    this.open();
    return this;
  }

  open() {
    clearTimeout(this.retryTimer); clearTimeout(this.handshakeTimer); clearInterval(this.pingTimer);
    this.live = false;
    this.onStatus(this.attempt ? "reconnecting" : "connecting", this.broker);
    let ws;
    try { ws = new WebSocket(this.broker, ["mqtt"]); } catch { return this.retry(); }
    ws.binaryType = "arraybuffer";
    this.socket = ws;
    this.handshakeTimer = setTimeout(() => { if (ws === this.socket && !this.live) ws.close(); }, 8000);
    ws.onopen = () => {
      if (ws !== this.socket) return;
      const keepAlive = 30;
      ws.send(frame(0x10, bytes(field("MQTT"), Uint8Array.of(4, 2, 0, keepAlive), field(this.clientId))));
    };
    ws.onmessage = (event) => { if (ws === this.socket) this.read(new Uint8Array(event.data)); };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (ws !== this.socket || this.stopped) return;
      this.live = false; clearInterval(this.pingTimer); clearTimeout(this.handshakeTimer);
      // A broker that never worked from here is probably blocked: try the backup once.
      if (!this.everLive && this.attempt === 0) this.brokerIndex = (this.brokerIndex + 1) % this.brokers.length;
      this.retry();
    };
    this.pingTimer = setInterval(() => this.raw(Uint8Array.of(0xc0, 0)), 20000);
  }

  retry() {
    this.attempt++;
    this.onStatus("reconnecting", this.broker);
    this.retryTimer = setTimeout(() => this.open(), Math.min(10000, 800 * 1.6 ** Math.min(this.attempt, 6)) * (0.75 + Math.random() * 0.5));
  }

  /** @param {Uint8Array} data */
  read(data) {
    let at = 0;
    while (at < data.length) {
      const type = data[at++];
      let mul = 1, len = 0, b, count = 0;
      do { if (at >= data.length) return; b = data[at++]; len += (b & 127) * mul; mul *= 128; count++; } while (b & 128 && count < 4);
      if (at + len > data.length) return;
      const payload = data.subarray(at, at + len);
      at += len;
      const kind = type >> 4;
      if (kind === 2) {
        if (payload[1] !== 0) { this.socket?.close(); return; }
        clearTimeout(this.handshakeTimer);
        this.live = true; this.everLive = true; this.attempt = 0;
        for (const topic of this.topics) this.raw(this.subscribePacket(topic));
        this.onStatus("live", this.broker);
        this.onLive();
      } else if (kind === 3) {
        const n = payload[0] * 256 + payload[1];
        const qos = (type >> 1) & 3;
        const topic = dec.decode(payload.subarray(2, 2 + n));
        if (!this.topics.has(topic)) continue;
        this.received++;
        try { this.onMessage(topic, JSON.parse(dec.decode(payload.subarray(2 + n + (qos ? 2 : 0))))); } catch { /* ignore malformed payloads */ }
      }
    }
  }

  raw(packet) { if (this.socket?.readyState === 1) this.socket.send(packet); }
  subscribePacket(topic) {
    this.packetId = (this.packetId % 65000) + 1;
    return frame(0x82, bytes(Uint8Array.of(this.packetId >> 8, this.packetId & 255), field(topic), Uint8Array.of(0)));
  }

  /** @param {string} topic */
  subscribe(topic) {
    if (this.topics.has(topic)) return;
    this.topics.add(topic);
    if (this.live) this.raw(this.subscribePacket(topic));
  }

  /** Publishes JSON. Returns false when offline or oversized (callers keep their own resend state). */
  publish(topic, data) {
    if (!this.live) return false;
    const body = enc.encode(typeof data === "string" ? data : JSON.stringify(data));
    if (body.length > this.maxBytes) return false;
    this.raw(frame(0x30, bytes(field(topic), body)));
    this.sent++;
    return true;
  }

  /** Simulates a dropped network (used by tests and the diagnostics panel). */
  drop() { this.socket?.close(); }

  close() {
    this.stopped = true; this.live = false;
    clearTimeout(this.retryTimer); clearTimeout(this.handshakeTimer); clearInterval(this.pingTimer);
    this.raw(Uint8Array.of(0xe0, 0));
    this.socket?.close();
    this.onStatus("closed");
  }
}

/** In-memory bus with the same publish/subscribe surface, for simulations and tests. */
export class LocalBus {
  constructor({ loss = 0, delay = 0 } = {}) {
    /** @type {Map<string, Set<LocalClient>>} */ this.topics = new Map();
    this.loss = loss; this.delay = delay; this.count = 0;
  }
  client(options = {}) { return new LocalClient(this, options); }
  deliver(from, topic, data) {
    this.count++;
    const json = JSON.stringify(data);
    for (const client of this.topics.get(topic) ?? []) {
      if (!client.live || (this.loss && Math.random() < this.loss)) continue;
      const send = () => client.live && client.onMessage(topic, JSON.parse(json));
      this.delay ? setTimeout(send, this.delay * Math.random()) : queueMicrotask(send);
    }
  }
}

class LocalClient {
  /** @param {LocalBus} bus */
  constructor(bus, { onMessage = (_t, _d) => {}, onStatus = (_s) => {}, onLive = () => {} } = {}) {
    Object.assign(this, { bus, onMessage, onStatus, onLive });
    this.live = false; this.topics = new Set(); this.sent = 0; this.received = 0;
  }
  connect() { this.live = true; this.onStatus("live", "local"); queueMicrotask(() => this.live && this.onLive()); return this; }
  subscribe(topic) {
    this.topics.add(topic);
    if (!this.bus.topics.has(topic)) this.bus.topics.set(topic, new Set());
    this.bus.topics.get(topic).add(this);
  }
  publish(topic, data) {
    if (!this.live) return false;
    this.sent++;
    this.bus.deliver(this, topic, data);
    return true;
  }
  drop() { this.live = false; this.onStatus("reconnecting", "local"); }
  close() { this.live = false; for (const t of this.topics) this.bus.topics.get(t)?.delete(this); this.onStatus("closed"); }
}
