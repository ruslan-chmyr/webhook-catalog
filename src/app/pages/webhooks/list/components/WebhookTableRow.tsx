import { Box, Button, HStack, Table, Text } from '@chakra-ui/react';
import type { Webhook } from '@/features/webhooks/model/types';

const createdAtFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

type WebhookTableRowProps = {
  webhook: Webhook;
  onEdit: (id: string) => void;
};

export function WebhookTableRow({ webhook, onEdit }: WebhookTableRowProps) {
  const isActive = webhook.active;

  return (
    <Table.Row>
      <Table.Cell fontWeight="medium">{webhook.name}</Table.Cell>
      <Table.Cell maxW="20rem" color="gray.600" whiteSpace="normal" wordBreak="break-all">
        {webhook.url}
      </Table.Cell>
      <Table.Cell>
        <HStack gap="2">
          <Box boxSize="2" rounded="full" bg={isActive ? 'green.500' : 'gray.400'} aria-hidden="true" />
          <Text fontSize="sm" color={isActive ? 'green.700' : 'gray.600'}>
            {isActive ? 'Active' : 'Inactive'}
          </Text>
        </HStack>
      </Table.Cell>
      <Table.Cell color="gray.700">{createdAtFormat.format(new Date(webhook.created_at))}</Table.Cell>
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
