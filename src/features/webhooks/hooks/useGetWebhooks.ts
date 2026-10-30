import { useQuery } from '@tanstack/react-query';
import { useAuthActive } from '@/features/auth/hooks/useAuthActive';
import { getWebhooks } from '@/features/webhooks/api/webhooksApi';
import { webhooksQueryKey } from '@/features/webhooks/model/queryKeys';
import type { WebhookListParams } from '@/features/webhooks/model/types';

export function useGetWebhooks(params: WebhookListParams) {
  const active = useAuthActive();

  return useQuery({
    queryKey: webhooksQueryKey(params),
    queryFn: ({ signal }) => getWebhooks(params, signal),
    enabled: active,
    retry: false,
  });
}
