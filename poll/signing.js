// @ts-check
// Presenter authenticity. Adapted from github.com/sanand0/mobile-games shared/signing.js. The room code is a hash of the presenter's public key.
// Participants accept control messages only when signed by a key that hashes to the room code, so the
// audience URL carries no secret. Works in browsers (secure contexts) and Node >= 22.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const b64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (text) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const ECDSA = { name: "ECDSA", namedCurve: "P-256" }, SIGN = { name: "ECDSA", hash: "SHA-256" };

async function roomFromKey(publicKey) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", unb64(publicKey)));
  return [...hash.slice(0, 8)].map((b) => ALPHABET[b & 31]).join("");
}

/** Creates (or restores from a JWK) the presenter key. Returns the signer and room code. */
async function presenterKey(jwk = null) {
  let privateKey, publicKey;
  if (jwk) {
    privateKey = await crypto.subtle.importKey("jwk", jwk, ECDSA, true, ["sign"]);
    const { d: _d, ...pub } = jwk;
    publicKey = await crypto.subtle.importKey("jwk", { ...pub, key_ops: ["verify"] }, ECDSA, true, ["verify"]);
  } else ({ privateKey, publicKey } = await crypto.subtle.generateKey(ECDSA, true, ["sign", "verify"]));
  const k = b64(await crypto.subtle.exportKey("raw", publicKey));
  const room = await roomFromKey(k);
  const sign = async (data) => {
    const d = JSON.stringify({ v: 1, at: Date.now(), ...data });
    return { d, k, s: b64(await crypto.subtle.sign(SIGN, privateKey, new TextEncoder().encode(d))) };
  };
  return { room, sign, jwk: await crypto.subtle.exportKey("jwk", privateKey) };
}

/** Returns an async verifier for envelopes on this room. Resolves to the payload, or null if forged. */
function verifier(room) {
  let trusted = null;
  return async (envelope) => {
    if (typeof envelope?.d !== "string" || typeof envelope.k !== "string" || typeof envelope.s !== "string") return null;
    try {
      if (trusted?.k !== envelope.k) {
        if ((await roomFromKey(envelope.k)) !== room) return null;
        trusted = { k: envelope.k, key: await crypto.subtle.importKey("raw", unb64(envelope.k), ECDSA, false, ["verify"]) };
      }
      if (!(await crypto.subtle.verify(SIGN, trusted.key, unb64(envelope.s), new TextEncoder().encode(envelope.d)))) return null;
      const data = JSON.parse(envelope.d);
      // Reject stale replays; allow for phone clock skew.
      return Math.abs(Date.now() - data.at) < 10 * 60e3 ? data : null;
    } catch {
      return null;
    }
  };
}

export { roomFromKey, presenterKey, verifier };
