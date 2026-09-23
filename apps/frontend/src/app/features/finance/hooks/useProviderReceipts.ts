'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getProviderReceiptErrorMessage,
  listProviderReceipts,
} from '@/app/features/finance/services/providerReceiptService';
import type {
  ProviderReceipt,
  ProviderReceiptStatus,
} from '@/app/features/finance/types/providerReceipt';

const LOAD_ERROR = 'Unable to load the reconciliation queue.';

export type ProviderReceiptQueue = {
  receipts: ProviderReceipt[];
  /** The first page of the current query. Distinct from `loadingMore`. */
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  /** There is at least one more page. Read from the response, not inferred. */
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
  /**
   * Put the stored receipt back over the row it replaces, by id.
   *
   * The readback after an allocation, not an optimistic edit: the caller passes
   * what the server answered with. A no-op when the id is not on any loaded
   * page, so a late answer for a row a filter change has already discarded
   * cannot reintroduce it.
   */
  replaceReceipt: (receipt: ProviderReceipt) => void;
};

/**
 * The reconciliation queue, one cursor page at a time (#3170 delivery 3).
 *
 * The filters arrive as three primitives rather than one options object so the
 * effect's dependencies are values, not an identity the caller has to memoise.
 * A caller that built `{ status }` inline would otherwise refetch on every
 * render.
 *
 * Pages accumulate rather than replace: the operator is working down a list and
 * a "load more" that discarded what was already read would lose their place.
 * Changing any filter starts a new list, because rows fetched under the old one
 * are not answers to the new question.
 */
export const useProviderReceipts = (
  organisationId: string | undefined,
  status?: ProviderReceiptStatus,
  capturedFrom?: string,
  capturedTo?: string
): ProviderReceiptQueue => {
  const [receipts, setReceipts] = useState<ProviderReceipt[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(Boolean(organisationId));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  /*
   * Bumped by the first-page effect, so a `loadMore` still in flight when the
   * filters change can tell that its answer belongs to a query nobody is
   * looking at any more. Without it a slow page-two response appends rows the
   * current filter excludes - money shown under a heading that denies it.
   */
  const generationRef = useRef(0);

  const loadKey = `${organisationId ?? ''}|${status ?? ''}|${capturedFrom ?? ''}|${capturedTo ?? ''}|${reloadToken}`;
  const [prevLoadKey, setPrevLoadKey] = useState(loadKey);
  if (prevLoadKey !== loadKey) {
    // Adjusting state during render, so the old rows never paint under the new
    // filter. The effect below does the fetching; this only clears.
    setPrevLoadKey(loadKey);
    setReceipts([]);
    setCursor(null);
    setHasMore(false);
    setError(null);
    setLoading(Boolean(organisationId));
    setLoadingMore(false);
  }

  useEffect(() => {
    if (!organisationId) return undefined;
    generationRef.current += 1;
    const generation = generationRef.current;
    let active = true;

    listProviderReceipts(organisationId, { status, capturedFrom, capturedTo })
      .then((page) => {
        if (!active) return;
        setReceipts(page.receipts);
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(getProviderReceiptErrorMessage(err, LOAD_ERROR));
        setLoading(false);
      });

    return () => {
      active = false;
      // Any in-flight loadMore belongs to this generation; retiring it here
      // means a late arrival cannot append to the list that replaces it.
      if (generationRef.current === generation) generationRef.current += 1;
    };
  }, [organisationId, status, capturedFrom, capturedTo, reloadToken]);

  const loadMore = useCallback(() => {
    if (!organisationId || !cursor || loadingMore) return;
    const generation = generationRef.current;
    setLoadingMore(true);

    listProviderReceipts(organisationId, { status, capturedFrom, capturedTo }, cursor)
      .then((page) => {
        if (generationRef.current !== generation) return;
        setReceipts((prev) => [...prev, ...page.receipts]);
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
        setLoadingMore(false);
      })
      .catch((err: unknown) => {
        if (generationRef.current !== generation) return;
        setError(getProviderReceiptErrorMessage(err, LOAD_ERROR));
        setLoadingMore(false);
      });
  }, [organisationId, cursor, loadingMore, status, capturedFrom, capturedTo]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  /*
   * Replaced in place rather than refetched, and kept even when its new state
   * no longer matches the active filter.
   *
   * Refetching would discard every page after the first, losing the operator's
   * place in a queue they are working down. Dropping the row because it is now
   * ALLOCATED and the filter says UNALLOCATED would take the result of the
   * write off the screen at the moment it succeeded - the reading is stale
   * against the filter, not against the money, and the next reload settles it.
   */
  const replaceReceipt = useCallback((updated: ProviderReceipt) => {
    setReceipts((prev) => prev.map((receipt) => (receipt.id === updated.id ? updated : receipt)));
  }, []);

  return { receipts, loading, loadingMore, error, hasMore, loadMore, reload, replaceReceipt };
};
