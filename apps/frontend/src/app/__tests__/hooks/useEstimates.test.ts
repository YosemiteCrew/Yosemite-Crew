import { act, renderHook, waitFor } from '@testing-library/react';
import type { Estimate, EstimateStatus } from '@/app/features/finance/types/estimate';

const estimateServiceMock = {
  listEstimates: jest.fn(),
  getEstimateErrorMessage: jest.fn(),
};
jest.mock('@/app/features/finance/services/estimateService', () => ({
  listEstimates: (...args: unknown[]) => estimateServiceMock.listEstimates(...args),
  getEstimateErrorMessage: (...args: unknown[]) =>
    estimateServiceMock.getEstimateErrorMessage(...args),
}));

import { useEstimates } from '@/app/features/finance/hooks/useEstimates';

/** A promise plus the handles to settle it, so a test can inspect mid-flight state. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const makeEstimate = (
  id: string,
  status: EstimateStatus = 'DRAFT',
  overrides: Partial<Estimate> = {}
): Estimate => ({
  id,
  organisationId: 'org-1',
  patientId: 'pet-1',
  encounterId: null,
  status,
  validUntil: null,
  subtotal: 100,
  taxAmount: 20,
  total: 120,
  currency: 'GBP',
  notes: null,
  approvedBy: null,
  approvedAt: null,
  declinedAt: null,
  declineReason: null,
  convertedToInvoiceId: null,
  createdBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  items: [],
  ...overrides,
});

const ids = (rows: Estimate[]) => rows.map((row) => row.id);

beforeEach(() => {
  jest.clearAllMocks();
  estimateServiceMock.listEstimates.mockResolvedValue([]);
  estimateServiceMock.getEstimateErrorMessage.mockImplementation(
    (error: unknown, fallback: string) =>
      error instanceof Error && error.message ? error.message : fallback
  );
});

describe('useEstimates', () => {
  it('does not fetch without an organisation id', async () => {
    const { result } = renderHook(() => useEstimates(undefined));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.estimates).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(estimateServiceMock.listEstimates).not.toHaveBeenCalled();
  });

  it('loads the organisation estimates', async () => {
    estimateServiceMock.listEstimates.mockResolvedValue([
      makeEstimate('est-1'),
      makeEstimate('est-2', 'SENT'),
    ]);

    const { result } = renderHook(() => useEstimates('org-1'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(ids(result.current.estimates)).toEqual(['est-1', 'est-2']);
    expect(result.current.error).toBeNull();
  });

  it('asks the service for every status when no filter is set', async () => {
    const { result } = renderHook(() => useEstimates('org-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(estimateServiceMock.listEstimates).toHaveBeenCalledWith('org-1', undefined);
  });

  it('passes the status filter through to the service', async () => {
    const { result } = renderHook(() => useEstimates('org-1', 'APPROVED'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(estimateServiceMock.listEstimates).toHaveBeenCalledWith('org-1', {
      status: 'APPROVED',
    });
  });

  it('captures a load failure and stops loading', async () => {
    estimateServiceMock.listEstimates.mockRejectedValue(new Error('Estimates unavailable.'));

    const { result } = renderHook(() => useEstimates('org-1'));

    await waitFor(() => expect(result.current.error).toBe('Estimates unavailable.'));
    expect(result.current.loading).toBe(false);
    expect(result.current.estimates).toEqual([]);
    expect(estimateServiceMock.getEstimateErrorMessage).toHaveBeenCalledWith(
      expect.any(Error),
      'Unable to load estimates.'
    );
  });

  it('falls back to the default message when the failure carries none', async () => {
    estimateServiceMock.listEstimates.mockRejectedValue({ response: { status: 500 } });

    const { result } = renderHook(() => useEstimates('org-1'));

    await waitFor(() => expect(result.current.error).toBe('Unable to load estimates.'));
    expect(result.current.loading).toBe(false);
  });

  it('refetches on reload', async () => {
    estimateServiceMock.listEstimates
      .mockResolvedValueOnce([makeEstimate('est-1')])
      .mockResolvedValueOnce([makeEstimate('est-1'), makeEstimate('est-2')]);

    const { result } = renderHook(() => useEstimates('org-1'));
    await waitFor(() => expect(ids(result.current.estimates)).toEqual(['est-1']));

    act(() => result.current.reload());

    await waitFor(() => expect(ids(result.current.estimates)).toEqual(['est-1', 'est-2']));
    expect(estimateServiceMock.listEstimates).toHaveBeenCalledTimes(2);
  });

  it('clears the previous organisation rows while the new organisation loads', async () => {
    // Otherwise the table shows another organisation's estimates during the switch.
    estimateServiceMock.listEstimates.mockResolvedValue([makeEstimate('org-1-est')]);
    const { result, rerender } = renderHook(({ orgId }) => useEstimates(orgId), {
      initialProps: { orgId: 'org-1' as string | undefined },
    });
    await waitFor(() => expect(ids(result.current.estimates)).toEqual(['org-1-est']));

    const pending = deferred<Estimate[]>();
    estimateServiceMock.listEstimates.mockReturnValue(pending.promise);
    rerender({ orgId: 'org-2' });

    expect(result.current.estimates).toEqual([]);
    expect(result.current.loading).toBe(true);

    await act(async () => {
      pending.resolve([makeEstimate('org-2-est', 'DRAFT', { organisationId: 'org-2' })]);
      await pending.promise;
    });

    expect(ids(result.current.estimates)).toEqual(['org-2-est']);
    expect(estimateServiceMock.listEstimates).toHaveBeenLastCalledWith('org-2', undefined);
  });

  it('refetches when the status filter changes', async () => {
    estimateServiceMock.listEstimates.mockResolvedValue([makeEstimate('draft-1', 'DRAFT')]);
    const { result, rerender } = renderHook(({ status }) => useEstimates('org-1', status), {
      initialProps: { status: undefined as EstimateStatus | undefined },
    });
    await waitFor(() => expect(ids(result.current.estimates)).toEqual(['draft-1']));

    estimateServiceMock.listEstimates.mockResolvedValue([makeEstimate('sent-1', 'SENT')]);
    rerender({ status: 'SENT' });

    await waitFor(() => expect(ids(result.current.estimates)).toEqual(['sent-1']));
    expect(estimateServiceMock.listEstimates).toHaveBeenCalledTimes(2);
    expect(estimateServiceMock.listEstimates).toHaveBeenLastCalledWith('org-1', {
      status: 'SENT',
    });
  });

  it('ignores a response that lands after unmount', async () => {
    const pending = deferred<Estimate[]>();
    estimateServiceMock.listEstimates.mockReturnValue(pending.promise);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderHook(() => useEstimates('org-1'));
    unmount();

    await act(async () => {
      pending.resolve([makeEstimate('est-late')]);
      await pending.promise;
    });

    // No state update on the unmounted hook => no React act/update warning.
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('ignores a rejection that lands after unmount', async () => {
    const pending = deferred<never>();
    estimateServiceMock.listEstimates.mockReturnValue(pending.promise);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderHook(() => useEstimates('org-1'));
    unmount();

    await act(async () => {
      pending.reject(new Error('too late'));
      await pending.promise.catch(() => undefined);
    });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(estimateServiceMock.getEstimateErrorMessage).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  describe('upsert', () => {
    it('adds an unknown estimate to the front of the list', async () => {
      estimateServiceMock.listEstimates.mockResolvedValue([
        makeEstimate('est-1'),
        makeEstimate('est-2'),
      ]);
      const { result } = renderHook(() => useEstimates('org-1'));
      await waitFor(() => expect(result.current.estimates).toHaveLength(2));

      act(() => result.current.upsert(makeEstimate('est-new')));

      expect(ids(result.current.estimates)).toEqual(['est-new', 'est-1', 'est-2']);
    });

    it('replaces a known estimate in place', async () => {
      estimateServiceMock.listEstimates.mockResolvedValue([
        makeEstimate('est-1'),
        makeEstimate('est-2'),
        makeEstimate('est-3'),
      ]);
      const { result } = renderHook(() => useEstimates('org-1'));
      await waitFor(() => expect(result.current.estimates).toHaveLength(3));

      act(() => result.current.upsert(makeEstimate('est-2', 'APPROVED', { total: 999 })));

      expect(ids(result.current.estimates)).toEqual(['est-1', 'est-2', 'est-3']);
      expect(result.current.estimates[1].status).toBe('APPROVED');
      expect(result.current.estimates[1].total).toBe(999);
    });

    it('keeps an estimate whose new status still matches the active filter', async () => {
      estimateServiceMock.listEstimates.mockResolvedValue([
        makeEstimate('est-1', 'DRAFT'),
        makeEstimate('est-2', 'DRAFT'),
      ]);
      const { result } = renderHook(() => useEstimates('org-1', 'DRAFT'));
      await waitFor(() => expect(result.current.estimates).toHaveLength(2));

      act(() => result.current.upsert(makeEstimate('est-1', 'DRAFT', { notes: 'edited' })));

      expect(ids(result.current.estimates)).toEqual(['est-1', 'est-2']);
      expect(result.current.estimates[0].notes).toBe('edited');
    });

    it('drops an estimate whose new status no longer matches the active filter', async () => {
      // Approving under the "Draft" pill must remove the row, not leave a row
      // reading APPROVED inside a list filtered to DRAFT.
      estimateServiceMock.listEstimates.mockResolvedValue([
        makeEstimate('est-1', 'DRAFT'),
        makeEstimate('est-2', 'DRAFT'),
      ]);
      const { result } = renderHook(() => useEstimates('org-1', 'DRAFT'));
      await waitFor(() => expect(result.current.estimates).toHaveLength(2));

      act(() => result.current.upsert(makeEstimate('est-1', 'APPROVED')));

      expect(ids(result.current.estimates)).toEqual(['est-2']);
      expect(result.current.estimates.some((row) => row.status !== 'DRAFT')).toBe(false);
    });

    it('does not add a brand-new estimate that the active filter excludes', async () => {
      estimateServiceMock.listEstimates.mockResolvedValue([makeEstimate('est-1', 'DRAFT')]);
      const { result } = renderHook(() => useEstimates('org-1', 'DRAFT'));
      await waitFor(() => expect(result.current.estimates).toHaveLength(1));

      act(() => result.current.upsert(makeEstimate('est-new', 'CONVERTED')));

      expect(ids(result.current.estimates)).toEqual(['est-1']);
    });
  });
});
