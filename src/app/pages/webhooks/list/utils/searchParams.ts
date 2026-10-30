export const WEBHOOK_PAGE_LIMIT = 10;

const PAGE_PATTERN = /^[1-9]\d*$/;

export type WebhookListLocation = {
  page: number;
  search: string;
};

// Keep only page (>1) and non-empty search; bad page values fall back to 1.
export function readWebhookListLocation(searchParams: URLSearchParams): WebhookListLocation {
  return {
    page: readPage(searchParams),
    search: readSearch(searchParams),
  };
}

export function canonicalWebhookSearchParams(page: number, search: string): URLSearchParams {
  const params = new URLSearchParams();
  const safePage = Number.isInteger(page) && page > 1 ? page : 1;
  const safeSearch = normalizeWebhookSearch(search);

  if (safePage > 1) {
    params.set('page', String(safePage));
  }
  if (safeSearch !== '') {
    params.set('search', safeSearch);
  }

  return params;
}

export function isCanonicalWebhookSearch(searchParams: URLSearchParams): boolean {
  const location = readWebhookListLocation(searchParams);
  return searchParams.toString() === canonicalWebhookSearchParams(location.page, location.search).toString();
}

export function normalizeWebhookSearch(value: string): string {
  return value.trim();
}

function readPage(searchParams: URLSearchParams): number {
  const values = searchParams.getAll('page');
  if (values.length !== 1) {
    return 1;
  }

  const value = values[0]?.trim() ?? '';
  if (!PAGE_PATTERN.test(value)) {
    return 1;
  }

  return Number(value);
}

function readSearch(searchParams: URLSearchParams): string {
  const values = searchParams.getAll('search');
  if (values.length === 0) {
    return '';
  }

  return normalizeWebhookSearch(values[0] ?? '');
}
