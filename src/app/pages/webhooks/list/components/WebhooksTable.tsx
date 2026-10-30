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
            <Table.ColumnHeader>Name</Table.ColumnHeader>
            <Table.ColumnHeader>URL</Table.ColumnHeader>
            <Table.ColumnHeader>Status</Table.ColumnHeader>
            <Table.ColumnHeader>Created at</Table.ColumnHeader>
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
