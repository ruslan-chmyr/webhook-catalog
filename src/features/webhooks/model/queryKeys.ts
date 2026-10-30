import { privateQueryKey } from '@/features/auth/model/currentUser';
import type { WebhookListParams } from './types';

export const webhooksQueryPrefix = [...privateQueryKey, 'webhooks'] as const;

export function webhooksQueryKey(params: WebhookListParams) {
  return [...webhooksQueryPrefix, params.page, params.limit, params.search] as const;
}

export function webhookQueryKey(id: string) {
  return [...webhooksQueryPrefix, 'detail', id] as const;
}
