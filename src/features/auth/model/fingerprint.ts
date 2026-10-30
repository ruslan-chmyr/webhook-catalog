export const FINGERPRINT_STORAGE_KEY = 'smart-sender.device-fingerprint';

export function getOrCreateFingerprint(): string {
  const existing = globalThis.localStorage.getItem(FINGERPRINT_STORAGE_KEY);
  if (existing !== null && isFingerprint(existing)) {
    return existing;
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const fingerprint = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  globalThis.localStorage.setItem(FINGERPRINT_STORAGE_KEY, fingerprint);
  return fingerprint;
}

function isFingerprint(value: string): boolean {
  return /^[0-9a-f]{32}$/.test(value);
}
