import { useEffect, useState } from 'react';
import type { WebhookListResponse } from '@/features/webhooks/model/types';
import { useGetWebhooks } from '@/features/webhooks/hooks/useGetWebhooks';
import { useWebhookListState } from './useWebhookListState';

export function useWebhooksPage() {
  const list = useWebhookListState();
  const [editingId, setEditingId] = useState<string | null>(null);
  const webhooks = useGetWebhooks({
    page: list.page,
    limit: list.limit,
    search: list.search,
  });
  const { page, replacePage } = list;
  const last = webhooks.data?.paging.pages.last;
  const outOfRange = last !== undefined && last >= 1 && page > last;
  const message = webhooks.error instanceof Error ? webhooks.error.message : 'Unable to load webhooks.';
  const records = webhooks.data;
  const showTable = records !== undefined && records.data.length > 0 && !outOfRange;
  const showEmpty = records !== undefined && records.data.length === 0 && !outOfRange && !webhooks.isError;
  const showSkeleton = webhooks.isPending || outOfRange;
  const showRefetchIndicator = webhooks.isFetching && !webhooks.isPending && !outOfRange;
  const showPagination = !webhooks.isPending && !outOfRange && !(webhooks.isError && records === undefined);
  const summary = resultSummary(records);

  useEffect(() => {
    if (last === undefined || last < 1 || page <= last) {
      return;
    }

    replacePage(last);
  }, [last, page, replacePage]);

  return {
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
    isError: webhooks.isError,
    openEdit: (id: string) => {
      setEditingId(id);
    },
    closeEdit: () => {
      setEditingId(null);
    },
    retry: () => {
      void webhooks.refetch();
    },
    goPrevious: () => {
      list.goToPage(page - 1);
    },
    goNext: () => {
      list.goToPage(page + 1);
    },
    goToPage: (nextPage: number) => {
      list.goToPage(nextPage);
    },
  };
}

function resultSummary(records: WebhookListResponse | undefined): string | undefined {
  if (records === undefined || records.paging.results.total < 1 || records.data.length < 1) {
    return undefined;
  }

  const start = (records.paging.pages.current - 1) * records.paging.results.limitation + 1;
  const end = start + records.data.length - 1;
  return `Showing ${start}–${end} of ${records.paging.results.total} results`;
}
