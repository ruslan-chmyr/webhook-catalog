import { HttpError } from '@/shared/api/errors';
import { isAbsoluteHttpUrl } from '@/features/webhooks/utils/webhookUrl';

export type WebhookFieldMessages = {
  name?: string;
  url?: string;
};

export function validateWebhookForm(name: string, url: string): WebhookFieldMessages {
  const errors: WebhookFieldMessages = {};
  if (name.trim() === '') {
    errors.name = 'Name is required.';
  }
  if (url.trim() === '') {
    errors.url = 'URL is required.';
  } else if (!isAbsoluteHttpUrl(url.trim())) {
    errors.url = 'Must be a valid HTTP/HTTPS URL.';
  }

  return errors;
}

export function fieldMessage(error: unknown, field: string): string | undefined {
  if (!(error instanceof HttpError)) {
    return undefined;
  }

  const messages = error.fieldErrors?.[field];
  if (messages === undefined || messages.length === 0) {
    return undefined;
  }

  return messages.join(' ');
}

export function generalMessage(error: unknown): string | undefined {
  if (error === null || error === undefined) {
    return undefined;
  }
  if (!(error instanceof HttpError)) {
    return error instanceof Error ? error.message : 'Unable to save this webhook.';
  }
  if (error.status === 422 && error.fieldErrors !== undefined && Object.keys(error.fieldErrors).length > 0) {
    return undefined;
  }

  return error.message;
}
