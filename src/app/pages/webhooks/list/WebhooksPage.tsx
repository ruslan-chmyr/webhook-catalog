import { Box, Flex, Heading, HStack, Spinner, Stack, Text } from '@chakra-ui/react';
import { WebhookEditDialog } from '../edit/WebhookEditDialog';
import { CatalogViewSwitcher } from './components/CatalogViewSwitcher';
import { MovieGrid } from './components/MovieGrid';
import { TmdbCredit } from './components/TmdbCredit';
import { WebhookListEmpty, WebhookListError, WebhookListSkeleton } from './components/WebhookListStates';
import { WebhookPagination } from './components/WebhookPagination';
import { WebhookSearch } from './components/WebhookSearch';
import { WebhooksTable } from './components/WebhooksTable';
import { useCatalogViewMode } from './hooks/useCatalogViewMode';
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
  const { mode, setMode } = useCatalogViewMode();

  return (
    <Stack
      gap="5"
      maxW="72rem"
      mx="auto"
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      rounded="xl"
      shadow="sm"
      p={{ base: '4', md: '6' }}
      overflow="hidden"
    >
      <Stack gap="2">
        <Flex align="flex-start" justify="space-between" gap="3" wrap="wrap">
          <Stack gap="1" minW="0" flex="1">
            <HStack gap="2" align="center" minW="0">
              <Heading as="h2" size="lg" letterSpacing="-0.02em">
                50 Greatest Movies of All Time
              </Heading>
              {showRefetchIndicator ? (
                <Box role="status" aria-label="Refreshing movies">
                  <Spinner size="sm" color="gray.500" />
                </Box>
              ) : null}
            </HStack>
            <Text color="gray.600" fontSize="sm" maxW="40rem">
              A curated collection of cinema&apos;s most iconic films, ranked by rating.
            </Text>
          </Stack>
          <CatalogViewSwitcher mode={mode} onChange={setMode} />
        </Flex>
      </Stack>
      <WebhookSearch value={list.input} onChange={list.setInput} />
      <WebhookListSkeleton visible={showSkeleton} />
      <WebhookListError visible={isError} message={message} onRetry={retry} />
      <WebhookListEmpty visible={showEmpty} search={list.search} />
      {showTable && records !== undefined ? (
        mode === 'grid' ? (
          <MovieGrid webhooks={records.data} onEdit={openEdit} />
        ) : (
          <WebhooksTable webhooks={records.data} onEdit={openEdit} />
        )
      ) : null}
      <WebhookEditDialog webhookId={editingId} onClose={closeEdit} />
      {summary && showPagination ? (
        <Text color="gray.600" fontSize="sm" display={{ base: 'block', sm: 'none' }}>
          {summary}
        </Text>
      ) : null}
      <Flex
        direction={{ base: 'column', lg: 'row' }}
        align={{ base: 'stretch', lg: 'flex-end' }}
        justify="space-between"
        gap="4"
        pt="1"
        wrap="wrap"
      >
        <TmdbCredit />
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
      </Flex>
    </Stack>
  );
}
