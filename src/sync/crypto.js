/* =====================================================================
   SYNC: CRYPTOGRAPHY (Web Crypto, built into every browser)

   Pairing (two devices that have never met):
     1. The device that starts (A) makes a fresh P-256 key pair and a random
        nonce, and first sends only a COMMITMENT: SHA-256(its public key,
        its nonce).
     2. The other device (B) answers with its own public key and nonce.
     3. A reveals its public key and nonce; B checks they match the
        commitment.
     4. Both work out the same 6-digit code from the two public keys and
        nonces. B shows it; the user types it on A. B's user also has to
        press Accept.
   Because A committed before seeing B's key, and B's key was sent before
   A's was revealed, someone in the middle can't pick keys that give a
   matching code: they would have a one-in-a-million guess, once. A wrong
   code ends the pairing.
   The shared secret (ECDH) is turned into a 256-bit AES-GCM key with
   HKDF. After pairing, every message is encrypted and authenticated with
   that key, so the sync service, the network, and other devices can't
   read or change anything.
   ===================================================================== */

const subtle = globalThis.crypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const CURVE = { name: 'ECDH', namedCurve: 'P-256' };

export function toBase64(bytes) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < array.length; i += 0x8000) binary += String.fromCharCode(...array.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function fromBase64(text) {
  const binary = atob(String(text));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomBase64(byteLength = 16) {
  return toBase64(globalThis.crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** A random id made of letters, digits, - and _ (safe in URLs and headers). */
export function randomId(prefix = '', byteLength = 12) {
  return prefix + randomBase64(byteLength).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Base64(...parts) {
  return toBase64(await subtle.digest('SHA-256', encoder.encode(parts.join('|'))));
}

/** A fresh key pair. The private key is kept as JWK so a pairing survives the background restarting. */
export async function createKeyPair() {
  const pair = await subtle.generateKey(CURVE, true, ['deriveBits']);
  return {
    privateJwk: await subtle.exportKey('jwk', pair.privateKey),
    publicKey: toBase64(await subtle.exportKey('raw', pair.publicKey)),
  };
}

export function commitmentFor(publicKey, nonce) {
  return sha256Base64('pomodoro-commit-v1', publicKey, nonce);
}

/** The 6-digit code both devices show. It depends on both public keys and both nonces. */
export async function verificationCode({ initiatorKey, responderKey, initiatorNonce, responderNonce }) {
  const digest = new Uint8Array(await subtle.digest('SHA-256', encoder.encode(['pomodoro-code-v1', initiatorKey, responderKey, initiatorNonce, responderNonce].join('|'))));
  const number = ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0;
  return String(number % 1000000).padStart(6, '0');
}

/** The pairing key both devices end up with (base64 of 32 bytes). */
export async function derivePairingKey({ privateJwk, peerPublicKey, initiatorKey, responderKey, initiatorNonce, responderNonce }) {
  const privateKey = await subtle.importKey('jwk', privateJwk, CURVE, false, ['deriveBits']);
  const publicKey = await subtle.importKey('raw', fromBase64(peerPublicKey), CURVE, false, []);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const hkdfKey = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(`${initiatorNonce}|${responderNonce}`),
      info: encoder.encode(`pomodoro-sync-v1|${initiatorKey}|${responderKey}`),
    },
    hkdfKey,
    256
  );
  return toBase64(bits);
}

async function aesKey(keyBase64) {
  return subtle.importKey('raw', fromBase64(keyBase64), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Encrypt and authenticate a value. `context` (e.g. "from>to") must match when decrypting. */
export async function encryptJson(keyBase64, value, context) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(context) },
    await aesKey(keyBase64),
    encoder.encode(JSON.stringify(value))
  );
  return { iv: toBase64(iv), ct: toBase64(ciphertext) };
}

/** Throws if the message was changed, sent with another key, or meant for another pair of devices. */
export async function decryptJson(keyBase64, box, context) {
  const plaintext = await subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(box.iv), additionalData: encoder.encode(context) },
    await aesKey(keyBase64),
    fromBase64(box.ct)
  );
  return JSON.parse(decoder.decode(plaintext));
}

/** Constant-time comparison of two short strings (the typed code). */
export function sameText(a, b) {
  const x = String(a);
  const y = String(b);
  let difference = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) difference |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return difference === 0;
}
