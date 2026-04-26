/**
 * utils/helpers.jsx
 * Shared utility functions for Chatterly
 */

/**
 * Format a timestamp to a readable time string (e.g. "3:45 PM")
 */
export const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date)) return '';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format a timestamp to a short date string.
 * - Yesterday → "Yesterday"
 * - Within the last 7 days → "Monday", "Tuesday", etc.
 * - Older → "23 Feb" or "23 Feb 2024"
 */
export const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date)) return '';

  const now = new Date();

  // Strip time for day comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.round((today - target) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'long' }); // e.g. "Monday"
  }

  // Older: show date + month, add year if different
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
};

/**
 * Returns true if the given timestamp falls on today's date.
 * Used in ChatList to decide whether to show time or date.
 */
export const isToday = (timestamp) => {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  if (isNaN(date)) return false;
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
};

/**
 * Truncate a string to a max length with ellipsis.
 */
export const truncate = (str, maxLength = 40) => {
  if (!str) return '';
  return str.length > maxLength ? `${str.slice(0, maxLength)}…` : str;
};

/**
 * Format bytes to a human-readable file size string.
 * e.g. 1048576 → "1.0 MB"
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

/**
 * Returns initials from a full name string.
 * e.g. "John Doe" → "JD", "Alice" → "A"
 */
export const getInitials = (name = '') => {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
};

const pickTextFromObject = (value) => {
  if (!value || typeof value !== 'object') return '';

  const candidates = [
    value.text,
    value.message,
    value.body,
    value.content,
    value.data,
    value.payload?.text,
    value.payload?.message,
    value.payload?.body,
  ];

  const firstString = candidates.find((item) => typeof item === 'string' && item.trim());
  return firstString ? firstString.trim() : '';
};

const isLikelyEncryptedEnvelopeObject = (value) => {
  if (!value || typeof value !== 'object') return false;

  const hasAlgorithm = typeof value.alg === 'string' && value.alg.trim().length > 0;
  const hasCipherField = typeof value.ciphertext === 'string' || typeof value.cipherText === 'string';
  const hasEnvelopeFields =
    typeof value.iv === 'string' ||
    typeof value.nonce === 'string' ||
    typeof value.tag === 'string' ||
    value.keys ||
    value.ek;

  return (hasAlgorithm && hasCipherField) || (hasCipherField && hasEnvelopeFields);
};

const isLikelyEncryptedEnvelopeString = (raw) => {
  if (typeof raw !== 'string') return false;
  const input = raw.trim();
  if (!input) return false;

  if ((input.startsWith('{') && input.endsWith('}')) || (input.startsWith('[') && input.endsWith(']'))) {
    try {
      const parsed = JSON.parse(input);
      return isLikelyEncryptedEnvelopeObject(parsed);
    } catch {
      return false;
    }
  }

  return false;
};

const decodeBase64Safe = (raw) => {
  if (typeof raw !== 'string' || !raw.trim()) return '';

  // Supports both standard base64 and URL-safe base64.
  const normalized = raw.trim().replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/=]+$/.test(normalized)) return '';

  try {
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return atob(padded);
  } catch {
    return '';
  }
};

export const getReadableMessageText = (message) => {
  if (!message) return '';

  // Primary path: server already decrypted (server:aes-gcm) or client
  // decrypted (client:rsa-aes) before storing in React state.
  const direct = typeof message.text === 'string' ? message.text.trim() : '';
  if (direct) {
    // Guard: never render a raw JSON cipher blob as visible text.
    if (isLikelyEncryptedEnvelopeString(direct)) return '';
    return direct;
  }

  // If cipherText is present but we couldn't decrypt it (e.g. old Signal
  // envelopes or a key-mismatch), return '' so the UI shows "Encrypted message".
  return '';
};

/**
 * Debounce a function call by `delay` ms.
 * Useful for search inputs.
 */
export const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};