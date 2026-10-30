import { describe, expect, it } from 'vitest';
import { FINGERPRINT_STORAGE_KEY, getOrCreateFingerprint } from './fingerprint';

describe('getOrCreateFingerprint', () => {
  it('creates a 32-character hex value and reuses it', () => {
    const first = getOrCreateFingerprint();

    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(getOrCreateFingerprint()).toBe(first);
    expect(localStorage.getItem(FINGERPRINT_STORAGE_KEY)).toBe(first);
    expect(Object.keys(localStorage)).toEqual([FINGERPRINT_STORAGE_KEY]);
  });

  it('replaces a stored value that is not a fingerprint', () => {
    localStorage.setItem(FINGERPRINT_STORAGE_KEY, 'not-a-fingerprint');

    const fingerprint = getOrCreateFingerprint();

    expect(fingerprint).toMatch(/^[0-9a-f]{32}$/);
    expect(fingerprint).not.toBe('not-a-fingerprint');
    expect(localStorage.getItem(FINGERPRINT_STORAGE_KEY)).toBe(fingerprint);
  });
});
