import { act, renderHook, waitFor } from '@testing-library/react';
import { useMedicationHistory } from '@/app/features/appointments/hooks/useMedicationHistory';
import { listMedicationAdministrations } from '@/app/features/appointments/services/medicationAdministrationService';
import type { MedicationAdministrationEntry } from '@/app/features/appointments/services/medicationAdministrationService';

jest.mock('@/app/features/appointments/services/medicationAdministrationService', () => ({
  listMedicationAdministrations: jest.fn(),
}));

const listMock = listMedicationAdministrations as jest.MockedFunction<
  typeof listMedicationAdministrations
>;

const entry = (
  overrides: Partial<MedicationAdministrationEntry> = {}
): MedicationAdministrationEntry => ({
  id: 'mar-1',
  organisationId: 'org-1',
  patientId: 'patient-1',
  encounterId: 'encounter-1',
  prescriptionId: 'rx-1',
  medicationName: 'Meloxicam',
  dose: '0.4 ml',
  route: 'Oral',
  scheduledAt: '2026-09-27T10:00:00.000Z',
  administeredAt: null,
  administeredBy: null,
  status: 'SCHEDULED',
  notes: null,
  createdAt: '2026-09-27T09:00:00.000Z',
  updatedAt: '2026-09-27T09:00:00.000Z',
  ...overrides,
});

const renderHistory = () => renderHook(() => useMedicationHistory('org-1', 'patient-1', 'enc-1'));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useMedicationHistory', () => {
  it('loads the encounter history ordered by scheduled time', async () => {
    listMock.mockResolvedValueOnce([
      entry({ id: 'mar-later', scheduledAt: '2026-09-28T10:00:00.000Z' }),
      entry({ id: 'mar-earlier', scheduledAt: '2026-09-26T10:00:00.000Z' }),
    ]);

    const { result } = renderHistory();

    await waitFor(() => expect(result.current.entries).toHaveLength(2));
    expect(result.current.entries.map((row) => row.id)).toEqual(['mar-earlier', 'mar-later']);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(listMock).toHaveBeenCalledWith('org-1', 'patient-1', 'enc-1');
  });

  it('reloads on demand after a failed load', async () => {
    listMock.mockRejectedValueOnce(new Error('network down'));
    listMock.mockResolvedValueOnce([entry()]);

    const { result } = renderHistory();

    await waitFor(() =>
      expect(result.current.error).toBe('Unable to load medication history. Please try again.')
    );
    expect(result.current.canRefresh).toBe(true);

    act(() => {
      result.current.clearError();
      result.current.reload();
    });

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.error).toBeNull();
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('stays idle and does not request until every identifier is known', async () => {
    const { result } = renderHook(() => useMedicationHistory('org-1', 'patient-1', undefined));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.entries).toEqual([]);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('reloads when the encounter changes', async () => {
    listMock.mockResolvedValueOnce([entry()]).mockResolvedValueOnce([entry({ id: 'mar-2' })]);

    const { result, rerender } = renderHook(
      ({ encounterId }: { encounterId: string }) =>
        useMedicationHistory('org-1', 'patient-1', encounterId),
      { initialProps: { encounterId: 'enc-1' } }
    );
    await waitFor(() => expect(result.current.entries).toHaveLength(1));

    rerender({ encounterId: 'enc-2' });

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    expect(listMock).toHaveBeenLastCalledWith('org-1', 'patient-1', 'enc-2');
    await waitFor(() => expect(result.current.entries[0].id).toBe('mar-2'));
  });

  it('adds a newly scheduled dose in scheduled order', async () => {
    listMock.mockResolvedValueOnce([
      entry({ id: 'mar-later', scheduledAt: '2026-09-28T10:00:00.000Z' }),
    ]);

    const { result } = renderHistory();
    await waitFor(() => expect(result.current.entries).toHaveLength(1));

    act(() => {
      result.current.appendEntry(
        entry({ id: 'mar-earlier', scheduledAt: '2026-09-26T10:00:00.000Z' })
      );
    });

    expect(result.current.entries.map((row) => row.id)).toEqual(['mar-earlier', 'mar-later']);
  });

  it('replaces only the dose whose outcome was recorded', async () => {
    listMock.mockResolvedValueOnce([entry(), entry({ id: 'mar-2', medicationName: 'Gabapentin' })]);

    const { result } = renderHistory();
    await waitFor(() => expect(result.current.entries).toHaveLength(2));

    act(() => {
      result.current.applyOutcome('mar-1', entry({ status: 'GIVEN' }));
    });

    expect(result.current.entries[0].status).toBe('GIVEN');
    expect(result.current.entries[1].status).toBe('SCHEDULED');
  });

  it('offers a reload for a failed write whose server state is unknown', async () => {
    listMock.mockResolvedValueOnce([]);
    const { result } = renderHistory();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.reportStaleData('Unable to record this outcome.');
    });

    expect(result.current.error).toBe('Unable to record this outcome.');
    expect(result.current.canRefresh).toBe(true);
  });

  it('reports a write that changed nothing without offering a reload', async () => {
    listMock.mockResolvedValueOnce([]);
    const { result } = renderHistory();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.reportFailure('Unable to schedule this dose. Please try again.');
    });

    expect(result.current.error).toBe('Unable to schedule this dose. Please try again.');
    expect(result.current.canRefresh).toBe(false);

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });
});
