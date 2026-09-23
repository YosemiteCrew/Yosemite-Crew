import { act, renderHook, waitFor } from '@testing-library/react';

const listProviderReceipts = jest.fn();
jest.mock('@/app/features/finance/services/providerReceiptService', () => ({
  listProviderReceipts: (...args: unknown[]) => listProviderReceipts(...args),
  getProviderReceiptErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

import { useProviderReceipts } from '@/app/features/finance/hooks/useProviderReceipts';
import type {
  ProviderReceipt,
  ProviderReceiptStatus,
} from '@/app/features/finance/types/providerReceipt';

/*
 * These two invariants are driven through the hook rather than the screen on
 * purpose. On the page the load-more control is `disabled` while a page is in
 * flight, so a second press never reaches the hook - which means a page test
 * cannot tell a working re-entrancy guard from a missing one. Calling
 * `loadMore` directly is the only instrument that can.
 */

const receipt = (id: string): ProviderReceipt =>
  ({
    id,
    provider: 'STRIPE',
    merchantAccountRef: 'acct_1',
    paymentRef: `pi_${id}`,
    organisationId: 'org-1',
    invoiceId: null,
    appointmentId: null,
    amount: 10,
    currency: 'GBP',
    capturedAt: '2026-09-12T14:03:00.000Z',
    status: 'UNALLOCATED',
    reason: null,
    refundedAmount: 0,
    version: 1,
    createdAt: '2026-09-12T14:03:05.000Z',
  }) as ProviderReceipt;

const page = (ids: string[], nextCursor: string | null = null) => ({
  receipts: ids.map(receipt),
  nextCursor,
  hasMore: nextCursor !== null,
  limit: 50,
});

const deferred = <T>() => {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
};

const renderQueue = (status?: ProviderReceiptStatus) =>
  renderHook(
    ({ state }: { state?: ProviderReceiptStatus }) => useProviderReceipts('org-1', state),
    {
      initialProps: { state: status },
    }
  );

beforeEach(() => {
  listProviderReceipts.mockReset();
});

describe('useProviderReceipts', () => {
  it('ignores a second loadMore while a page is already in flight', async () => {
    const second = deferred<unknown>();
    listProviderReceipts.mockResolvedValueOnce(page(['a'], 'cur-2'));
    listProviderReceipts.mockReturnValueOnce(second.promise);

    const { result } = renderQueue();
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.loadingMore).toBe(true));

    // The second call is what would post a duplicate page - and, with the same
    // cursor, duplicate rows for money already on screen.
    act(() => result.current.loadMore());
    expect(listProviderReceipts).toHaveBeenCalledTimes(2);

    await act(async () => {
      second.settle(page(['b']));
      await second.promise;
    });
    expect(result.current.receipts.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('never applies a page that belongs to a query the filters have replaced', async () => {
    const stale = deferred<unknown>();
    listProviderReceipts.mockResolvedValueOnce(page(['a'], 'cur-2'));
    listProviderReceipts.mockReturnValueOnce(stale.promise);
    listProviderReceipts.mockResolvedValueOnce(page(['filtered']));

    const { result, rerender } = renderQueue();
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.loadingMore).toBe(true));

    rerender({ state: 'UNATTRIBUTED' });
    await waitFor(() => expect(result.current.receipts.map((row) => row.id)).toEqual(['filtered']));

    await act(async () => {
      stale.settle(page(['stale']));
      await stale.promise;
    });

    expect(result.current.receipts.map((row) => row.id)).toEqual(['filtered']);
  });

  it('never applies a failure that belongs to a query the filters have replaced', async () => {
    let rejectStale: (reason: unknown) => void = () => {};
    const stale = new Promise((_resolve, reject) => {
      rejectStale = reject;
    });
    listProviderReceipts.mockResolvedValueOnce(page(['a'], 'cur-2'));
    listProviderReceipts.mockReturnValueOnce(stale);
    listProviderReceipts.mockResolvedValueOnce(page(['filtered']));

    const { result, rerender } = renderQueue();
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.loadingMore).toBe(true));

    rerender({ state: 'UNATTRIBUTED' });
    await waitFor(() => expect(result.current.receipts.map((row) => row.id)).toEqual(['filtered']));

    await act(async () => {
      rejectStale(new Error('the question nobody is asking any more'));
      await stale.catch(() => undefined);
    });

    expect(result.current.error).toBeNull();
  });

  it('asks for nothing at all without an organisation', async () => {
    const { result } = renderHook(() => useProviderReceipts(undefined));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listProviderReceipts).not.toHaveBeenCalled();
    expect(result.current.receipts).toEqual([]);

    // loadMore has no query to extend either, so it must not invent one.
    act(() => result.current.loadMore());
    expect(listProviderReceipts).not.toHaveBeenCalled();
  });

  it('drops the previous organisation rows the instant the organisation goes away', async () => {
    listProviderReceipts.mockResolvedValue(page(['a']));

    const { result, rerender } = renderHook(
      ({ org }: { org?: string }) => useProviderReceipts(org),
      { initialProps: { org: 'org-1' as string | undefined } }
    );
    await waitFor(() => expect(result.current.receipts.map((row) => row.id)).toEqual(['a']));

    /*
     * With no organisation there is no fetch to replace the list, so nothing
     * downstream clears it: one organisation's captured payments would stay on
     * screen after the user left that organisation.
     */
    rerender({ org: undefined });

    expect(result.current.receipts).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(listProviderReceipts).toHaveBeenCalledTimes(1);
  });

  it('reloads from the first page on demand, dropping the cursor it had', async () => {
    listProviderReceipts.mockResolvedValueOnce(page(['a'], 'cur-2'));
    listProviderReceipts.mockResolvedValueOnce(page(['a-fresh']));

    const { result } = renderQueue();
    await waitFor(() => expect(result.current.receipts.map((row) => row.id)).toEqual(['a']));

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.receipts.map((row) => row.id)).toEqual(['a-fresh']));
    expect(listProviderReceipts).toHaveBeenLastCalledWith('org-1', {
      status: undefined,
      capturedFrom: undefined,
      capturedTo: undefined,
    });
    expect(result.current.hasMore).toBe(false);
  });
  /*
   * The readback after an allocation. Driven through the hook because the
   * screen's own path to it runs through a dialog: a page test that saw the
   * row change could not tell replacing it in place from refetching the
   * queue, and those differ in whether the operator keeps their place in it.
   */
  it('puts a stored receipt back over the row it replaces, without refetching', async () => {
    listProviderReceipts.mockResolvedValueOnce(page(['a', 'b'], 'cur-2'));

    const { result } = renderQueue();
    await waitFor(() => expect(result.current.receipts).toHaveLength(2));

    act(() =>
      result.current.replaceReceipt({
        ...receipt('b'),
        status: 'ALLOCATED',
        allocatedAmount: 10,
        version: 2,
      })
    );

    expect(result.current.receipts.map((row) => row.id)).toEqual(['a', 'b']);
    expect(result.current.receipts[1]).toMatchObject({ status: 'ALLOCATED', version: 2 });
    expect(result.current.receipts[0].status).toBe('UNALLOCATED');
    // The cursor and the pages already read are untouched.
    expect(listProviderReceipts).toHaveBeenCalledTimes(1);
    expect(result.current.hasMore).toBe(true);
  });

  it('ignores a receipt no loaded page is showing', async () => {
    listProviderReceipts.mockResolvedValueOnce(page(['a']));

    const { result } = renderQueue();
    await waitFor(() => expect(result.current.receipts).toHaveLength(1));

    act(() => result.current.replaceReceipt({ ...receipt('z'), status: 'ALLOCATED' }));

    expect(result.current.receipts.map((row) => row.id)).toEqual(['a']);
  });
});
