import { describe, expect, it } from 'vitest';
import { canonicalWebhookSearchParams, isCanonicalWebhookSearch, readWebhookListLocation } from './searchParams';

describe('webhook list URL normalization', () => {
  it('omits the default page and empty search', () => {
    expect(readWebhookListLocation(new URLSearchParams(''))).toEqual({
      page: 1,
      search: '',
    });
    expect(canonicalWebhookSearchParams(1, '').toString()).toBe('');
    expect(canonicalWebhookSearchParams(1, '   ').toString()).toBe('');
  });

  it('keeps page and search in a stable order', () => {
    const current = new URLSearchParams('search=webhook&page=2');

    expect(readWebhookListLocation(current)).toEqual({
      page: 2,
      search: 'webhook',
    });
    expect(isCanonicalWebhookSearch(current)).toBe(false);
    expect(canonicalWebhookSearchParams(2, 'webhook').toString()).toBe('page=2&search=webhook');
    expect(isCanonicalWebhookSearch(new URLSearchParams('page=2&search=webhook'))).toBe(true);
  });

  it('treats invalid and repeated page values as page 1', () => {
    for (const search of [
      'page=0',
      'page=-3',
      'page=2.5',
      'page=1.0',
      'page=abc',
      'page=',
      'page=1e2',
      'page=2&page=4',
    ]) {
      expect(readWebhookListLocation(new URLSearchParams(search)).page).toBe(1);
    }
  });

  it('trims a valid page and search before they are requested', () => {
    expect(readWebhookListLocation(new URLSearchParams('page=%202%20&search=%20webhook%20'))).toEqual({
      page: 2,
      search: 'webhook',
    });
    expect(canonicalWebhookSearchParams(2, '  webhook  ').toString()).toBe('page=2&search=webhook');
  });

  it('drops limit and keeps the first search when search is repeated', () => {
    const current = new URLSearchParams('limit=50&search=alpha&search=beta&page=3');

    expect(readWebhookListLocation(current)).toEqual({
      page: 3,
      search: 'alpha',
    });
    expect(isCanonicalWebhookSearch(current)).toBe(false);
    expect(canonicalWebhookSearchParams(3, 'alpha').toString()).toBe('page=3&search=alpha');
  });
});
