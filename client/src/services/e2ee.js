/**
 * e2ee.js  —  WhatsApp-style End-to-End Encryption
 *
 * Flow:
 *   Send   : AES-256-GCM encrypts plaintext → RSA-OAEP wraps the AES key
 *   Receive: RSA-OAEP unwraps AES key → AES-256-GCM decrypts ciphertext
 *
 * Key storage: private key (pkcs8 base64) kept in sessionStorage.
 *              Public  key bundle fetched from server at login time.
 */

import { keyAPI } from './api.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

const b64 = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));

const fromB64 = (str) =>
  Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

// ─── key import ──────────────────────────────────────────────────────────────

const RSA_PARAMS = { name: 'RSA-OAEP', hash: 'SHA-256' };

export async function importPublicKey(base64Der) {
  return crypto.subtle.importKey(
    'spki',
    fromB64(base64Der),
    RSA_PARAMS,
    false,
    ['encrypt']
  );
}

export async function importPrivateKey(base64Der) {
  return crypto.subtle.importKey(
    'pkcs8',
    fromB64(base64Der),
    RSA_PARAMS,
    false,
    ['decrypt']
  );
}

// ─── session key cache ───────────────────────────────────────────────────────

// Maps userId → { privateKey: CryptoKey }
const _myKeyCache = {};
const SESSION_KEY = 'e2ee_privkey';

/** Initialise E2EE for the logged-in user.
 *  - Fetches (or generates) the key bundle from the server.
 *  - Stores the private key (base64) in sessionStorage for this tab.
 *  - Returns the private CryptoKey ready to use.
 */
export async function initMyE2EE(userId) {
  if (_myKeyCache[userId]) return _myKeyCache[userId].privateKey;

  try {
    // Always prefer latest server bundle to avoid stale-key decrypt failures.
    const res = await keyAPI.bootstrap();
    const { privateKey: privB64 } = res.data?.data || {};

    if (privB64) {
      sessionStorage.setItem(`${SESSION_KEY}_${userId}`, privB64);
      const privKey = await importPrivateKey(privB64);
      _myKeyCache[userId] = { privateKey: privKey };
      return privKey;
    }
  } catch {
    // Fall back to locally cached key when bootstrap is temporarily unavailable.
  }

  // Fallback: sessionStorage key (survives page refresh in same tab)
  const stored = sessionStorage.getItem(`${SESSION_KEY}_${userId}`);
  if (stored) {
    try {
      const privKey = await importPrivateKey(stored);
      _myKeyCache[userId] = { privateKey: privKey };
      return privKey;
    } catch {
      return null;
    }
  }

  return null;
}

// ─── encrypt (sender side) ───────────────────────────────────────────────────

/**
 * Encrypt `plaintext` for a recipient.
 * @param {string} recipientPubKeyB64 - spki base64 public key
 * @param {string} plaintext
 * @returns {string} JSON envelope (store as cipherText in DB)
 */
export async function encryptForRecipient(recipientPubKeyB64, plaintext) {
  const recipientPubKey = await importPublicKey(recipientPubKeyB64);

  // 1. Generate ephemeral AES-256-GCM key
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const aesRaw = await crypto.subtle.exportKey('raw', aesKey);

  // 2. Encrypt the plaintext
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    enc.encode(plaintext)
  );

  // 3. Wrap (RSA-encrypt) the AES key with recipient's public key
  const wrappedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    recipientPubKey,
    aesRaw
  );

  return JSON.stringify({
    v: 2,
    alg: 'RSA-OAEP+AES-256-GCM',
    iv: b64(iv),
    ciphertext: b64(cipherBuf),
    wrappedKey: b64(wrappedKey),
  });
}

// ─── decrypt (receiver side) ─────────────────────────────────────────────────

/**
 * Decrypt an envelope created by `encryptForRecipient`.
 * @param {string} envelope - JSON string stored as cipherText
 * @param {CryptoKey} privateKey - recipient's RSA private CryptoKey
 * @returns {string} plaintext, or '' on failure
 */
export async function decryptEnvelope(envelope, privateKey) {
  if (!envelope || !privateKey) return '';

  try {
    const { v, alg, iv, ciphertext, wrappedKey } = JSON.parse(envelope);

    if (v !== 2 || alg !== 'RSA-OAEP+AES-256-GCM') return '';

    // 1. Unwrap the AES key
    const aesRaw = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      fromB64(wrappedKey)
    );
    const aesKey = await crypto.subtle.importKey(
      'raw',
      aesRaw,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // 2. Decrypt the message
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(iv) },
      aesKey,
      fromB64(ciphertext)
    );

    return new TextDecoder().decode(plainBuf);
  } catch {
    return '';
  }
}

// ─── fetch recipient public key ───────────────────────────────────────────────

export async function getRecipientPublicKey(recipientId) {
  const res = await keyAPI.getBundle(recipientId);
  const pubB64 = res.data?.data?.identityKey;
  if (!pubB64) throw new Error('No public key for recipient');
  return pubB64;
}
