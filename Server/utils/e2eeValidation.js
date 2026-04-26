const BASE64_REGEX = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const isNonEmptyString = (value, maxLen = 20000) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maxLen;

const isLikelyBase64 = (value, { minLen = 16, maxLen = 20000 } = {}) => {
  if (!isNonEmptyString(value, maxLen)) return false;
  const compact = value.replace(/\s+/g, "");
  if (compact.length < minLen || compact.length % 4 !== 0) return false;
  return BASE64_REGEX.test(compact);
};

const normalizePreKeys = (preKeys) => {
  if (!Array.isArray(preKeys)) {
    return { ok: false, message: "oneTimePreKeys must be an array" };
  }

  if (preKeys.length > 1000) {
    return { ok: false, message: "oneTimePreKeys cannot exceed 1000 entries" };
  }

  const seen = new Set();
  const cleaned = [];

  for (const item of preKeys) {
    const keyId = Number(item?.keyId);
    const publicKey = item?.publicKey;

    if (!Number.isInteger(keyId) || keyId < 1) {
      return { ok: false, message: "Each one-time prekey must include a positive integer keyId" };
    }

    if (seen.has(keyId)) {
      return { ok: false, message: "Duplicate keyId detected in oneTimePreKeys" };
    }

    if (!isLikelyBase64(publicKey, { minLen: 32, maxLen: 2000 })) {
      return { ok: false, message: `Invalid one-time prekey publicKey for keyId ${keyId}` };
    }

    seen.add(keyId);
    cleaned.push({ keyId, publicKey, isUsed: false });
  }

  return { ok: true, value: cleaned };
};

export const validateKeyBundlePayload = (body) => {
  const identityKey = body?.identityKey;
  const signedPreKeyId = Number(body?.signedPreKeyId);
  const signedPreKeyPublic = body?.signedPreKeyPublic;
  const signedPreKeySignature = body?.signedPreKeySignature;

  if (!isLikelyBase64(identityKey, { minLen: 32, maxLen: 2000 })) {
    return { ok: false, message: "identityKey must be a valid base64 public key" };
  }

  if (!Number.isInteger(signedPreKeyId) || signedPreKeyId < 1) {
    return { ok: false, message: "signedPreKeyId must be a positive integer" };
  }

  if (!isLikelyBase64(signedPreKeyPublic, { minLen: 32, maxLen: 2000 })) {
    return { ok: false, message: "signedPreKeyPublic must be a valid base64 public key" };
  }

  if (!isLikelyBase64(signedPreKeySignature, { minLen: 32, maxLen: 4000 })) {
    return { ok: false, message: "signedPreKeySignature must be valid base64" };
  }

  let normalizedPreKeys;
  if (body?.oneTimePreKeys !== undefined) {
    const normalized = normalizePreKeys(body.oneTimePreKeys);
    if (!normalized.ok) return normalized;
    normalizedPreKeys = normalized.value;
  }

  return {
    ok: true,
    value: {
      identityKey,
      signedPreKeyId,
      signedPreKeyPublic,
      signedPreKeySignature,
      oneTimePreKeys: normalizedPreKeys,
    },
  };
};

export const validateOneTimePreKeysPayload = (body) => {
  const normalized = normalizePreKeys(body?.oneTimePreKeys);
  if (!normalized.ok) return normalized;
  return { ok: true, value: normalized.value };
};

export const validateOutgoingMessagePayload = ({
  body,
  hasAttachment,
  allowLegacyPlaintext,
}) => {
  const cipherText = body?.cipherText;
  const contentType = body?.contentType;
  const text = body?.text;

  if (!cipherText && !text && !hasAttachment) {
    return { ok: false, message: "Provide cipherText or encrypted attachment payload" };
  }

  if (cipherText && !isLikelyBase64(cipherText, { minLen: 24, maxLen: 4000000 })) {
    return { ok: false, message: "cipherText must be valid base64" };
  }

  if (contentType && typeof contentType !== "string") {
    return { ok: false, message: "contentType must be a string" };
  }

  if (!cipherText && text && !allowLegacyPlaintext) {
    return {
      ok: false,
      message: "Plaintext messages are disabled. Send cipherText from the client.",
    };
  }

  return { ok: true };
};
