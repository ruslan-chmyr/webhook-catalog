import { readCurrentUser, type MockFailure, type MockFieldErrors, type MockResult } from './authState';
import { isAbsoluteHttpUrl } from '@/features/webhooks/utils/webhookUrl';

export type MockWebhook = {
  id: string;
  name: string;
  url: string;
  active: boolean;
  created_at: string;
};

export type MockWebhookList = {
  data: MockWebhook[];
  paging: {
    pages: {
      current: number;
      last: number;
    };
    results: {
      total: number;
      limitation: number;
    };
  };
};

const WEBHOOK_COUNT = 28;

function createInitialWebhooks(): MockWebhook[] {
  return Array.from({ length: WEBHOOK_COUNT }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    const url =
      index === 0
        ? `https://example.com/${'destination/'.repeat(12)}webhook-${number}`
        : `https://example.com/hooks/webhook-${number}`;

    return {
      id: `webhook-${number}`,
      name: `Webhook ${number}`,
      url,
      active: index % 2 === 0,
      created_at: new Date(Date.UTC(2024, 0, index + 1, 12, 0, 0)).toISOString(),
    };
  });
}

let webhooks = createInitialWebhooks();

export function resetMockWebhooks(): void {
  webhooks = createInitialWebhooks();
}

export function listWebhooks(url: URL): MockResult<MockWebhookList> {
  const session = readCurrentUser();
  if (!session.ok) {
    return session;
  }

  const page = readPositiveInt(url.searchParams.get('page'), 1);
  const limit = readPositiveInt(url.searchParams.get('limit'), 10);
  const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();
  const filtered = webhooks.filter((webhook) => {
    if (search === '') {
      return true;
    }

    return webhook.name.toLowerCase().includes(search);
  });
  const last = Math.max(1, Math.ceil(filtered.length / limit));
  const start = (page - 1) * limit;

  return {
    ok: true,
    value: {
      data: filtered.slice(start, start + limit).map(copyWebhook),
      paging: {
        pages: {
          current: page,
          last,
        },
        results: {
          total: filtered.length,
          limitation: limit,
        },
      },
    },
  };
}

export function readWebhook(id: string): MockResult<MockWebhook> {
  const session = readCurrentUser();
  if (!session.ok) {
    return session;
  }

  const webhook = webhooks.find((item) => item.id === id);
  if (webhook === undefined) {
    return notFound();
  }

  return {
    ok: true,
    value: copyWebhook(webhook),
  };
}

export function updateWebhook(id: string, body: unknown): MockResult<MockWebhook> {
  const session = readCurrentUser();
  if (!session.ok) {
    return session;
  }

  const index = webhooks.findIndex((item) => item.id === id);
  if (index < 0) {
    return notFound();
  }

  const record = isRecord(body) ? body : {};
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const url = typeof record.url === 'string' ? record.url.trim() : '';
  const fieldErrors: MockFieldErrors = {};

  if (name === '') {
    fieldErrors.name = ['Name is required.'];
  }
  if (url === '') {
    fieldErrors.url = ['URL is required.'];
  } else if (!isAbsoluteHttpUrl(url)) {
    fieldErrors.url = ['Must be a valid HTTP/HTTPS URL.'];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return validation(fieldErrors);
  }

  const current = webhooks[index];
  if (current === undefined) {
    return notFound();
  }

  const updated: MockWebhook = {
    ...current,
    name,
    url,
  };
  webhooks[index] = updated;
  return {
    ok: true,
    value: copyWebhook(updated),
  };
}

function copyWebhook(webhook: MockWebhook): MockWebhook {
  return { ...webhook };
}

function notFound(): MockFailure {
  return {
    ok: false,
    status: 404,
    type: 'NotFoundException',
    message: 'Webhook not found.',
  };
}

function validation(fieldErrors: MockFieldErrors): MockFailure {
  return {
    ok: false,
    status: 422,
    type: 'ValidationException',
    message: 'The given data was invalid.',
    fieldErrors,
  };
}

function readPositiveInt(value: string | null, fallback: number): number {
  if (value === null || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
