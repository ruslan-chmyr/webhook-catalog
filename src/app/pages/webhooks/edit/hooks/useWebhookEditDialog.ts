import { useRef, useState } from 'react';
import { fieldMessage, generalMessage, validateWebhookForm, type WebhookFieldMessages } from '../utils/webhookForm';
import type { Webhook } from '@/features/webhooks/model/types';
import { useGetWebhook } from '@/features/webhooks/hooks/useGetWebhook';
import { useUpdateWebhook } from '@/features/webhooks/hooks/useUpdateWebhook';

type UseWebhookEditDialogOptions = {
  webhookId: string | null;
  onClose: () => void;
};

export function useWebhookEditDialog({ webhookId, onClose }: UseWebhookEditDialogOptions) {
  const detail = useGetWebhook(webhookId);
  const update = useUpdateWebhook();
  const savingRef = useRef(false);

  const [saving, setSaving] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [clientErrors, setClientErrors] = useState<WebhookFieldMessages>({});
  
  const open = webhookId !== null;
  const webhook = detail.data !== undefined && detail.data.id === webhookId ? detail.data : undefined;

  if (webhook !== undefined && webhook.id !== loadedId) {
    setLoadedId(webhook.id);
    setName(webhook.name);
    setUrl(webhook.url);
    setClientErrors({});
  }

  function dismiss(): void {
    if (savingRef.current) {
      return;
    }

    setLoadedId(null);
    setName('');
    setUrl('');
    setClientErrors({});
    update.reset();
    onClose();
  }

  async function onSave(current: Webhook): Promise<void> {
    if (savingRef.current) {
      return;
    }

    const nextErrors = validateWebhookForm(name, url);
    if (nextErrors.name !== undefined || nextErrors.url !== undefined) {
      update.reset();
      setClientErrors(nextErrors);
      return;
    }

    setClientErrors({});
    savingRef.current = true;
    setSaving(true);

    try {
      await update.mutateAsync({
        id: current.id,
        name: name.trim(),
        url: url.trim(),
      });
      savingRef.current = false;
      setSaving(false);
      dismiss();
    } catch {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const nameError = clientErrors.name ?? fieldMessage(update.error, 'name');
  const urlError = clientErrors.url ?? fieldMessage(update.error, 'url');
  const generalError =
    clientErrors.name === undefined && clientErrors.url === undefined ? generalMessage(update.error) : undefined;

  return {
    open,
    saving,
    webhook,
    name,
    url,
    nameError,
    urlError,
    generalError,
    detailPending: webhookId !== null && detail.isPending,
    detailError: webhookId !== null && detail.isError,
    detailErrorMessage: detail.error instanceof Error ? detail.error.message : 'Unable to load this webhook.',
    setName,
    setUrl,
    dismiss,
    onSave,
    retryDetail: () => {
      void detail.refetch();
    },
  };
}
