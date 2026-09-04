import { act, renderHook, waitFor } from '@testing-library/react';

import { useControlledSubstanceLogs } from '@/app/features/compliance/hooks/useControlledSubstanceLogs';
import {
  fetchControlledSubstanceLogs,
  getControlledSubstanceErrorMessage,
} from '@/app/features/compliance/services/controlledSubstanceService';
import type { ControlledSubstanceLog } from '@/app/features/compliance/types/controlledSubstance';

jest.mock('@/app/features/compliance/services/controlledSubstanceService', () => ({
  fetchControlledSubstanceLogs: jest.fn(),
  getControlledSubstanceErrorMessage: jest.fn(() => 'friendly error'),
}));

const mockFetch = fetchControlledSubstanceLogs as jest.Mock;

const row = (id: string): ControlledSubstanceLog =>
  ({ id, drug: 'Ketamine', deaSchedule: 'III' }) as ControlledSubstanceLog;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useControlledSubstanceLogs', () => {
  it('loads the register for an organisation', async () => {
    mockFetch.mockResolvedValue([row('a')]);
    const { result } = renderHook(() =>
      useControlledSubstanceLogs('org-1', { fromDate: 'f', toDate: 't' })
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.logs).toEqual([row('a')]);
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith('org-1', { fromDate: 'f', toDate: 't' });
  });

  it('surfaces a friendly error when the load fails', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useControlledSubstanceLogs('org-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('friendly error');
    expect(getControlledSubstanceErrorMessage).toHaveBeenCalled();
  });

  it('does nothing without an organisation id', () => {
    const { result } = renderHook(() => useControlledSubstanceLogs(undefined));
    expect(result.current.loading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refetches when reload is called', async () => {
    mockFetch.mockResolvedValue([row('a')]);
    const { result } = renderHook(() => useControlledSubstanceLogs('org-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.reload();
    });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });

  it('ignores a resolved load after unmount', async () => {
    let resolveFetch: (rows: ControlledSubstanceLog[]) => void = () => {};
    mockFetch.mockReturnValue(
      new Promise<ControlledSubstanceLog[]>((resolve) => {
        resolveFetch = resolve;
      })
    );
    const { unmount } = renderHook(() => useControlledSubstanceLogs('org-1'));
    unmount();
    await act(async () => {
      resolveFetch([row('a')]);
    });
    // No throw: the `active` guard swallowed the late resolution.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('ignores a rejected load after unmount', async () => {
    let rejectFetch: (err: unknown) => void = () => {};
    mockFetch.mockReturnValue(
      new Promise<ControlledSubstanceLog[]>((_resolve, reject) => {
        rejectFetch = reject;
      })
    );
    const { unmount } = renderHook(() => useControlledSubstanceLogs('org-1'));
    unmount();
    await act(async () => {
      rejectFetch(new Error('late'));
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('resets and refetches when the date range changes', async () => {
    mockFetch.mockResolvedValue([row('a')]);
    const { result, rerender } = renderHook(
      ({ range }) => useControlledSubstanceLogs('org-1', range),
      { initialProps: { range: { fromDate: 'f1' } as { fromDate?: string } } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ range: { fromDate: 'f2' } });
    // The render-phase reset flips loading back on for the new query.
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).toHaveBeenLastCalledWith('org-1', { fromDate: 'f2', toDate: undefined });
  });
});
