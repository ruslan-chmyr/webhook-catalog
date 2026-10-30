import { useQuery } from '@tanstack/react-query';
import { useAuthActive } from '@/features/auth/hooks/useAuthActive';
import { getWebhook } from '@/features/webhooks/api/webhooksApi';
import { webhookQueryKey } from '@/features/webhooks/model/queryKeys';

export function useGetWebhook(id: string | null) {
  const active = useAuthActive();

  return useQuery({
    queryKey: webhookQueryKey(id ?? 'none'),
    queryFn: ({ signal }) => {
      if (id === null) {
        throw new Error('Webhook id is missing.');
      }

      return getWebhook(id, signal);
    },
    enabled: active && id !== null,
    retry: false,
  });
}
