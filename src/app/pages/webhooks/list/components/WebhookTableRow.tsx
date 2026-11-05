import { useEffect, useState } from 'react';
import { Button, HStack, Table, Text } from '@chakra-ui/react';
import type { Webhook } from '@/features/webhooks/model/types';
import { copyText } from '@/shared/utils/copyText';
import { formatDuration } from '../utils/movieFacts';

const releasedAtFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const VISIBLE_LINK_LENGTH = 36;

type WebhookTableRowProps = {
  webhook: Webhook;
  onEdit: (id: string) => void;
};

export function WebhookTableRow({ webhook, onEdit }: WebhookTableRowProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopied(false);
    }, 1200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [copied]);

  return (
    <Table.Row>
      <Table.Cell fontWeight="medium">{webhook.name}</Table.Cell>
      <Table.Cell fontVariantNumeric="tabular-nums">
        <HStack gap="1">
          <Text as="span" color="yellow.500" aria-hidden="true">
            ★
          </Text>
          {webhook.rating.toFixed(1)}
        </HStack>
      </Table.Cell>
      <Table.Cell maxW="16rem" color="gray.600">
        <HStack gap="1" minW="0">
          <Text truncate minW="0" title={webhook.url} whiteSpace="nowrap">
            {cutLink(webhook.url)}
          </Text>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            flexShrink="0"
            h="6"
            minW="6"
            px="1"
            aria-label={
              copied ? `Copied IMDb link for ${webhook.name}` : `Copy IMDb link for ${webhook.name}`
            }
            onClick={() => {
              void copyText(webhook.url).then((didCopy) => {
                if (didCopy) {
                  setCopied(true);
                }
              });
            }}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </HStack>
      </Table.Cell>
      <Table.Cell color="gray.700">{formatDuration(webhook.duration)}</Table.Cell>
      <Table.Cell color="gray.700">{releasedAtFormat.format(new Date(webhook.created_at))}</Table.Cell>
      <Table.Cell>
        <Button
          type="button"
          size="xs"
          variant="outline"
          aria-label={`Edit ${webhook.name}`}
          onClick={() => {
            onEdit(webhook.id);
          }}
        >
          Edit
        </Button>
      </Table.Cell>
    </Table.Row>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function cutLink(url: string): string {
  if (url.length <= VISIBLE_LINK_LENGTH) {
    return url;
  }

  return `${url.slice(0, VISIBLE_LINK_LENGTH - 1)}…`;
}
