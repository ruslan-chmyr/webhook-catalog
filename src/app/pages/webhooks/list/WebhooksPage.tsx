import { Box, Heading, HStack, Spinner, Stack, Text } from '@chakra-ui/react';
import { WebhookEditDialog } from '../edit/WebhookEditDialog';
import { WebhookListEmpty, WebhookListError, WebhookListSkeleton } from './components/WebhookListStates';
import { WebhookPagination } from './components/WebhookPagination';
import { WebhookSearch } from './components/WebhookSearch';
import { WebhooksTable } from './components/WebhooksTable';
import { useWebhooksPage } from './hooks/useWebhooksPage';

export function WebhooksPage() {
  const {
    list,
    page,
    editingId,
    records,
    message,
    summary,
    showTable,
    showEmpty,
    showSkeleton,
    showRefetchIndicator,
    showPagination,
    isError,
    openEdit,
    closeEdit,
    retry,
    goPrevious,
    goNext,
    goToPage,
  } = useWebhooksPage();

  return (
    <Stack
      gap="5"
      maxW="64rem"
      mx="auto"
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      rounded="xl"
      shadow="sm"
      p="6"
      overflow="hidden"
    >
      <Stack gap="1">
        <HStack gap="2" align="center">
          <Heading as="h2" size="lg">
            Webhooks
          </Heading>
          {showRefetchIndicator ? (
            <Box role="status" aria-label="Refreshing webhooks">
              <Spinner size="sm" color="gray.500" />
            </Box>
          ) : null}
        </HStack>
        <Text color="gray.600">Manage your webhooks and receive event notifications</Text>
      </Stack>
      <WebhookSearch value={list.input} onChange={list.setInput} />
      <WebhookListSkeleton visible={showSkeleton} />
      <WebhookListError visible={isError} message={message} onRetry={retry} />
      <WebhookListEmpty visible={showEmpty} search={list.search} />
      {showTable && records !== undefined ? (
        <WebhooksTable webhooks={records.data} onEdit={openEdit} />
      ) : null}
      <WebhookEditDialog webhookId={editingId} onClose={closeEdit} />
      {showPagination ? (
        <WebhookPagination
          current={records?.paging.pages.current ?? page}
          last={records?.paging.pages.last}
          summary={summary}
          onPrevious={goPrevious}
          onNext={goNext}
          onPage={goToPage}
        />
      ) : null}
    </Stack>
  );
}
