import { Table } from '@chakra-ui/react';
import type { Webhook } from '@/features/webhooks/model/types';
import { WebhookTableRow } from './WebhookTableRow';

type WebhooksTableProps = {
  webhooks: readonly Webhook[];
  onEdit: (id: string) => void;
};

export function WebhooksTable({ webhooks, onEdit }: WebhooksTableProps) {
  return (
    <Table.ScrollArea maxW="100%">
      <Table.Root size="sm" variant="line" minW="40rem">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Movie title</Table.ColumnHeader>
            <Table.ColumnHeader>Rating</Table.ColumnHeader>
            <Table.ColumnHeader>IMDb link</Table.ColumnHeader>
            <Table.ColumnHeader>Duration</Table.ColumnHeader>
            <Table.ColumnHeader>Released at</Table.ColumnHeader>
            <Table.ColumnHeader>Actions</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {webhooks.map((webhook) => (
            <WebhookTableRow key={webhook.id} webhook={webhook} onEdit={onEdit} />
          ))}
        </Table.Body>
      </Table.Root>
    </Table.ScrollArea>
  );
}
