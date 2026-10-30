import { Button, Field, Input, Skeleton, Stack, Text, VisuallyHidden } from '@chakra-ui/react';
import { AppDialog } from '@/shared/ui/AppDialog';
import { useWebhookEditDialog } from './hooks/useWebhookEditDialog';

type WebhookEditDialogProps = {
  webhookId: string | null;
  onClose: () => void;
};

const EDIT_WEBHOOK_FORM_ID = 'edit-webhook-form';

export function WebhookEditDialog({ webhookId, onClose }: WebhookEditDialogProps) {
  const {
    open,
    saving,
    webhook,
    name,
    url,
    nameError,
    urlError,
    generalError,
    detailPending,
    detailError,
    detailErrorMessage,
    setName,
    setUrl,
    dismiss,
    onSave,
    retryDetail,
  } = useWebhookEditDialog({ webhookId, onClose });

  const hasNameError = nameError !== undefined;
  const hasUrlError = urlError !== undefined;
  const hasGeneralError = generalError !== undefined;

  if (webhook === undefined) {
    if (!open) {
      return null;
    }

    return (
      <AppDialog open={open} title="Edit Webhook" onClose={dismiss} closeDisabled={saving}>
        {detailPending ? (
          <Stack gap="3">
            <VisuallyHidden>Loading webhook…</VisuallyHidden>
            <Skeleton height="10" rounded="md" />
            <Skeleton height="10" rounded="md" />
          </Stack>
        ) : null}
        {detailError ? (
          <Stack gap="3">
            <Text role="alert" color="red.700">
              {detailErrorMessage}
            </Text>
            <Button type="button" colorPalette="blue" alignSelf="start" onClick={retryDetail}>
              Try again
            </Button>
          </Stack>
        ) : null}
      </AppDialog>
    );
  }

  return (
    <AppDialog
      open={open}
      title="Edit Webhook"
      onClose={dismiss}
      closeDisabled={saving}
      formId={EDIT_WEBHOOK_FORM_ID}
      onSubmit={() => {
        void onSave(webhook);
      }}
      cancelButtonText="Cancel"
      submitButtonText={saving ? 'Saving…' : 'Save'}
    >
      <Stack gap="4">
        <Field.Root invalid={hasNameError}>
          <Field.Label htmlFor="webhook-name">Name</Field.Label>
          <Input
            id="webhook-name"
            value={name}
            disabled={saving}
            aria-invalid={hasNameError ? true : undefined}
            aria-describedby={hasNameError ? 'webhook-name-error' : undefined}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          {hasNameError ? <Field.ErrorText id="webhook-name-error">{nameError}</Field.ErrorText> : null}
        </Field.Root>
        <Field.Root invalid={hasUrlError}>
          <Field.Label htmlFor="webhook-url">URL</Field.Label>
          <Input
            id="webhook-url"
            value={url}
            disabled={saving}
            aria-invalid={hasUrlError ? true : undefined}
            aria-describedby={hasUrlError ? 'webhook-url-error' : undefined}
            onChange={(event) => {
              setUrl(event.target.value);
            }}
          />
          {hasUrlError ? <Field.ErrorText id="webhook-url-error">{urlError}</Field.ErrorText> : null}
        </Field.Root>
        {hasGeneralError ? (
          <Text role="alert" color="red.700">
            {generalError}
          </Text>
        ) : null}
      </Stack>
    </AppDialog>
  );
}
