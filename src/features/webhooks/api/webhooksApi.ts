import { protectedClient } from '@/app/composition';
import type { Webhook, WebhookListParams, WebhookListResponse, WebhookUpdate } from '../model/types';

export async function getWebhooks(params: WebhookListParams, signal?: AbortSignal): Promise<WebhookListResponse> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
    search: params.search,
  });
  const value = await protectedClient.request(
    {
      path: `/v1/webhooks?${query.toString()}`,
      signal,
    },
    parseWebhookList,
  );

  if (value === undefined) {
    throw new Error('Webhooks response was empty.');
  }

  return value;
}

export async function getWebhook(id: string, signal?: AbortSignal): Promise<Webhook> {
  const value = await protectedClient.request(
    {
      path: webhookPath(id),
      signal,
    },
    parseWebhook,
  );

  if (value === undefined) {
    throw new Error('Webhook response was empty.');
  }

  return value;
}

export async function updateWebhook(id: string, update: WebhookUpdate): Promise<Webhook> {
  const value = await protectedClient.request(
    {
      method: 'PUT',
      path: webhookPath(id),
      body: {
        name: update.name,
        url: update.url,
      },
    },
    parseWebhook,
  );

  if (value === undefined) {
    throw new Error('Webhook response was empty.');
  }

  return value;
}

function webhookPath(id: string): string {
  return `/v1/webhooks/${encodeURIComponent(id)}`;
}

export function parseWebhookList(value: unknown): WebhookListResponse {
  if (!isRecord(value) || !Array.isArray(value.data) || !isRecord(value.paging)) {
    throw new Error('Webhooks response is invalid.');
  }

  const { pages, results } = value.paging;
  if (!isRecord(pages) || !isRecord(results)) {
    throw new Error('Webhooks response is invalid.');
  }

  return {
    data: value.data.map(parseWebhook),
    paging: {
      pages: {
        current: readNumber(pages, 'current'),
        last: readNumber(pages, 'last'),
      },
      results: {
        total: readNumber(results, 'total'),
        limitation: readNumber(results, 'limitation'),
      },
    },
  };
}

export function parseWebhook(value: unknown): Webhook {
  if (!isRecord(value)) {
    throw new Error('Webhooks response is invalid.');
  }

  const { id, name, url, active, created_at: createdAt } = value;
  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof url !== 'string' ||
    typeof active !== 'boolean' ||
    typeof createdAt !== 'string'
  ) {
    throw new Error('Webhooks response is invalid.');
  }

  return {
    id,
    name,
    url,
    active,
    created_at: createdAt,
  };
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Webhooks response is invalid.');
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
