import crypto from "crypto";

const ALGO = "aes-256-gcm";
const VERSION = "v1";

const getSecret = () =>
  process.env.MESSAGE_CRYPTO_SECRET ||
  process.env.MSG_CRYPTO_SECRET ||
  process.env.JWT_SECRET ||
  "dev-insecure-message-crypto-secret";

const getKey = () => crypto.createHash("sha256").update(getSecret()).digest();

const b64 = (buf) => Buffer.from(buf).toString("base64");
const fromB64 = (value) => Buffer.from(value, "base64");

/**
 * Encrypt legacy plaintext fallback payloads on the server.
 */
export const encryptMessageText = (plainText) => {
  const text = typeof plainText === "string" ? plainText.trim() : "";
  if (!text) return "";

  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, getKey(), iv);

    const encrypted = Buffer.concat([
      cipher.update(text, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return `${VERSION}.${b64(iv)}.${b64(tag)}.${b64(encrypted)}`;
  } catch (error) {
    console.error("❌ encryptMessageText failed:", error.message);
    return "";
  }
};

/**
 * Decrypt server-generated fallback payloads only.
 */
export const decryptMessageText = (cipherText, contentType) => {
  if (!cipherText || typeof cipherText !== "string") return "";

  if (contentType && contentType !== "server:aes-gcm") {
    return "";
  }

  try {
    const [version, ivB64, tagB64, dataB64] = cipherText.split(".");
    if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) return "";

    const decipher = crypto.createDecipheriv(ALGO, getKey(), fromB64(ivB64));
    decipher.setAuthTag(fromB64(tagB64));

    const decrypted = Buffer.concat([
      decipher.update(fromB64(dataB64)),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    return "";
  }
};

/**
 * Server-side decrypt a client:rsa-aes envelope using the recipient's
 * stored RSA private key (pkcs8 DER, base64).
 *
 * Envelope JSON format:
 *   { v: 2, alg: "RSA-OAEP+AES-256-GCM", iv, ciphertext, wrappedKey }
 *
 * Web Crypto's AES-GCM encrypt() appends the 16-byte auth tag to the
 * ciphertext buffer, so we strip it before passing to Node's decipher.
 *
 * @param {string} envelopeJson  - the cipherText field stored in DB
 * @param {string} privateKeyB64 - pkcs8 DER base64 (UserKeys.privateKey)
 * @returns {string} plaintext, or "" on any failure
 */
export const decryptClientE2EE = (envelopeJson, privateKeyB64) => {
  if (!envelopeJson || !privateKeyB64) return "";
  try {
    const { v, alg, iv, ciphertext, wrappedKey } = JSON.parse(envelopeJson);
    if (v !== 2 || alg !== "RSA-OAEP+AES-256-GCM") return "";

    // 1. Reconstruct the RSA private key from pkcs8 DER bytes
    const privKeyDer = Buffer.from(privateKeyB64, "base64");
    const privateKey = crypto.createPrivateKey({
      key: privKeyDer,
      format: "der",
      type: "pkcs8",
    });

    // 2. RSA-OAEP-SHA256 unwrap the ephemeral AES key
    const aesKeyBuf = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(wrappedKey, "base64")
    );

    // 3. AES-256-GCM decrypt
    //    SubtleCrypto appends the 16-byte GCM auth tag at the END of ciphertext
    const cipherBuf = Buffer.from(ciphertext, "base64");
    const authTag = cipherBuf.slice(-16);
    const encData = cipherBuf.slice(0, -16);
    const ivBuf = Buffer.from(iv, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", aesKeyBuf, ivBuf);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([decipher.update(encData), decipher.final()]);

    return plain.toString("utf8");
  } catch {
    return "";
  }
};
