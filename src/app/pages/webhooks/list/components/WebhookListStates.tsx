import { Box, Button, EmptyState, Skeleton, Stack, Text, VisuallyHidden } from '@chakra-ui/react';

type WebhookListSkeletonProps = {
  visible: boolean;
};

export function WebhookListSkeleton({ visible }: WebhookListSkeletonProps) {
  if (!visible) {
    return null;
  }

  return (
    <Stack gap="3">
      <VisuallyHidden>Loading webhooks…</VisuallyHidden>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} height="10" rounded="md" />
      ))}
    </Stack>
  );
}

type WebhookListErrorProps = {
  visible: boolean;
  message: string;
  onRetry: () => void;
};

export function WebhookListError({ visible, message, onRetry }: WebhookListErrorProps) {
  if (!visible) {
    return null;
  }

  return (
    <EmptyState.Root>
      <EmptyState.Content>
        <EmptyState.Indicator>
          <ErrorMark />
        </EmptyState.Indicator>
        <EmptyState.Title>Failed to load webhooks</EmptyState.Title>
        <EmptyState.Description>
          <Text as="span" role="alert">
            {message}
          </Text>
        </EmptyState.Description>
        <Button type="button" colorPalette="blue" onClick={onRetry}>
          Try again
        </Button>
      </EmptyState.Content>
    </EmptyState.Root>
  );
}

type WebhookListEmptyProps = {
  visible: boolean;
  search: string;
};

export function WebhookListEmpty({ visible, search }: WebhookListEmptyProps) {
  if (!visible) {
    return null;
  }

  const hasSearch = search !== '';

  return (
    <EmptyState.Root>
      <EmptyState.Content>
        <EmptyState.Indicator>
          <InboxMark />
        </EmptyState.Indicator>
        <EmptyState.Title>{hasSearch ? 'No webhooks match your search.' : 'No webhooks found.'}</EmptyState.Title>
        <EmptyState.Description>
          {hasSearch ? 'Try adjusting your search or check back later.' : 'Webhooks you add will show up here.'}
        </EmptyState.Description>
      </EmptyState.Content>
    </EmptyState.Root>
  );
}

function ErrorMark() {
  return (
    <Box color="red.500" aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 13h-2v2h2v-2Zm0-8h-2v6h2V7Z" />
      </svg>
    </Box>
  );
}

function InboxMark() {
  return (
    <Box color="gray.400" aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 13h5l2 3h4l2-3h5v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z" />
        <path d="M3 13 6 4h12l3 9" />
      </svg>
    </Box>
  );
}
