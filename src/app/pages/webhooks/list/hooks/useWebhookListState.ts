import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
  WEBHOOK_PAGE_LIMIT,
  canonicalWebhookSearchParams,
  isCanonicalWebhookSearch,
  normalizeWebhookSearch,
  readWebhookListLocation,
} from '../utils/searchParams';

export const WEBHOOK_SEARCH_DEBOUNCE_MS = 350;

export function useWebhookListState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = readWebhookListLocation(searchParams);
  const { page, search } = location;

  useEffect(() => {
    if (isCanonicalWebhookSearch(searchParams)) {
      return;
    }

    setSearchParams(canonicalWebhookSearchParams(page, search), {
      replace: true,
    });
  }, [page, search, searchParams, setSearchParams]);

  const [input, setInput] = useState(search);
  const [seenSearch, setSeenSearch] = useState(search);
  const [committedSearch, setCommittedSearch] = useState(search);
  const debouncedInput = useDebounce(input, WEBHOOK_SEARCH_DEBOUNCE_MS);

  let externalSearchChange = false;
  if (search !== seenSearch) {
    setSeenSearch(search);

    if (search === committedSearch) {
      if (input !== search && normalizeWebhookSearch(input) === search) {
        setInput(search);
      }
    } else {
      externalSearchChange = true;
      setCommittedSearch(search);
      setInput(search);
    }
  }

  if (!externalSearchChange && input === debouncedInput) {
    const settled = normalizeWebhookSearch(input);

    if (settled !== search && settled !== committedSearch) {
      setCommittedSearch(settled);
    } else if (settled === search && input !== settled) {
      setInput(settled);
    }
  }

  useEffect(() => {
    function onPopState() {
      const next = readWebhookListLocation(new URLSearchParams(window.location.search)).search;
      
      setCommittedSearch(next);
      setSeenSearch(next);
      setInput(next);
    }

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useEffect(() => {
    if (committedSearch === search) {
      return;
    }

    setSearchParams(canonicalWebhookSearchParams(1, committedSearch), {
      replace: true,
    });
  }, [committedSearch, search, setSearchParams]);

  const goToPage = useCallback(
    (nextPage: number) => {
      setSearchParams(canonicalWebhookSearchParams(nextPage, search));
    },
    [search, setSearchParams],
  );

  const replacePage = useCallback(
    (nextPage: number) => {
      const next = canonicalWebhookSearchParams(nextPage, search);
      if (searchParams.toString() === next.toString()) {
        return;
      }

      setSearchParams(next, { replace: true });
    },
    [search, searchParams, setSearchParams],
  );

  return {
    page,
    limit: WEBHOOK_PAGE_LIMIT,
    search,
    input,
    setInput,
    goToPage,
    replacePage,
  };
}
