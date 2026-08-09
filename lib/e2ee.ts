/**
 * End-to-end encryption for friend messages, WebCrypto only (client-side).
 *
 * Each user has an ECDH P-256 keypair: the private key lives in this
 * browser's localStorage, the public key is published to profiles.public_key.
 * A per-friendship AES-GCM key is derived with ECDH (both sides derive the
 * same key), and message bodies are stored as {v, iv, ct} envelopes — the
 * server only ever sees ciphertext.
 *
 * Honest limits (documented, not hidden): keys are per-browser (a new device
 * or cleared storage means a new keypair and old messages stay unreadable
 * there), there's no forward secrecy (one static key per pair, no ratchet),
 * and — as with any web app — whoever serves the JavaScript could ship code
 * that leaks keys. "The database only holds ciphertext" is the guarantee.
 */

export interface StoredKeyPair {
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
}

interface Envelope {
  v: 1;
  iv: string; // base64
  ct: string; // base64
}

const KEY_STORAGE = "beanlo-e2ee-keypair";
const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** This browser's keypair, created on first use. */
export async function getOrCreateKeyPair(): Promise<StoredKeyPair> {
  const raw = localStorage.getItem(KEY_STORAGE);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StoredKeyPair;
      if (parsed.publicJwk && parsed.privateJwk) return parsed;
    } catch {
      // fall through and regenerate
    }
  }
  const pair = await crypto.subtle.generateKey(ECDH, true, ["deriveKey"]);
  const stored: StoredKeyPair = {
    publicJwk: await crypto.subtle.exportKey("jwk", pair.publicKey),
    privateJwk: await crypto.subtle.exportKey("jwk", pair.privateKey),
  };
  localStorage.setItem(KEY_STORAGE, JSON.stringify(stored));
  return stored;
}

/** The shared AES key for one friendship — same result on both sides. */
export async function deriveSharedKey(
  myPrivateJwk: JsonWebKey,
  theirPublicJwk: JsonWebKey
): Promise<CryptoKey> {
  const priv = await crypto.subtle.importKey("jwk", myPrivateJwk, ECDH, false, [
    "deriveKey",
  ]);
  const pub = await crypto.subtle.importKey("jwk", theirPublicJwk, ECDH, false, []);
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: pub },
    priv,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(
  key: CryptoKey,
  plaintext: string
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const env: Envelope = { v: 1, iv: toB64(iv), ct: toB64(ct) };
  return JSON.stringify(env);
}

/** Null when the body can't be decrypted (other device's keys, tampering). */
export async function decryptMessage(
  key: CryptoKey,
  body: string
): Promise<string | null> {
  try {
    const env = JSON.parse(body) as Envelope;
    if (env.v !== 1 || !env.iv || !env.ct) return null;
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(env.iv) as BufferSource },
      key,
      fromB64(env.ct) as BufferSource
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}
