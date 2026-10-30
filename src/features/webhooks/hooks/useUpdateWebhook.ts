import { useMutation } from '@tanstack/react-query';
import { queryClient, session } from '@/app/composition';
import { updateWebhook } from '@/features/webhooks/api/webhooksApi';
import { webhookQueryKey, webhooksQueryPrefix } from '@/features/webhooks/model/queryKeys';
import type { WebhookUpdate } from '@/features/webhooks/model/types';

type UpdateWebhookVariables = WebhookUpdate & {
  id: string;
};

export function useUpdateWebhook() {
  return useMutation({
    mutationFn: async (variables: UpdateWebhookVariables) => {
      const epoch = session.getAuthEpoch();
      const webhook = await updateWebhook(variables.id, {
        name: variables.name,
        url: variables.url,
      });

      if (!session.isActive() || session.getAuthEpoch() !== epoch) {
        throw new Error('Protected request is stale.');
      }

      return { webhook, epoch };
    },
    onSuccess: ({ webhook, epoch }) => {
      if (!session.isActive() || session.getAuthEpoch() !== epoch) {
        return;
      }

      queryClient.setQueryData(webhookQueryKey(webhook.id), webhook);
      void queryClient.invalidateQueries({ queryKey: webhooksQueryPrefix });
    },
  });
}
