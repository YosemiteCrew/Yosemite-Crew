import { act, renderHook, waitFor } from '@testing-library/react';
import { useCalendarBlocks } from '@/app/features/appointments/components/Calendar/useCalendarBlocks';
import { useNotify } from '@/app/hooks/useNotify';
import { useOrgStore } from '@/app/stores/orgStore';
import {
  createCalendarBlock,
  deleteCalendarBlock,
  fetchCalendarBlocks,
  updateCalendarBlock,
} from '@/app/features/appointments/services/calendarBlockService';

jest.mock('@/app/hooks/useNotify', () => ({ useNotify: jest.fn() }));
jest.mock('@/app/stores/orgStore', () => ({ useOrgStore: jest.fn() }));
jest.mock('@/app/features/appointments/services/calendarBlockService', () => ({
  createCalendarBlock: jest.fn(),
  deleteCalendarBlock: jest.fn(),
  fetchCalendarBlocks: jest.fn(),
  updateCalendarBlock: jest.fn(),
}));

const mockUseNotify = useNotify as jest.Mock;
const mockUseOrgStore = useOrgStore as unknown as jest.Mock;
const mockFetch = fetchCalendarBlocks as jest.Mock;
const mockCreate = createCalendarBlock as jest.Mock;
const mockUpdate = updateCalendarBlock as jest.Mock;
const mockDelete = deleteCalendarBlock as jest.Mock;
const notify = jest.fn();

const block = (id: string) => ({
  id,
  organisationId: 'org-1',
  targetType: 'STAFF' as const,
  targetId: 'staff-1',
  startAt: '2026-09-26T09:00:00.000Z',
  endAt: '2026-09-26T10:00:00.000Z',
  reason: 'Training',
  createdBy: null,
  createdAt: '2026-09-25T09:00:00.000Z',
  updatedAt: '2026-09-25T09:00:00.000Z',
});

describe('useCalendarBlocks', () => {
  let primaryOrgId: string | null;

  beforeEach(() => {
    jest.clearAllMocks();
    primaryOrgId = 'org-1';
    mockUseNotify.mockReturnValue({ notify });
    mockUseOrgStore.mockImplementation((selector) => selector({ primaryOrgId }));
    mockFetch.mockResolvedValue([]);
    mockCreate.mockResolvedValue(block('created'));
    mockUpdate.mockResolvedValue(block('updated'));
    mockDelete.mockResolvedValue(undefined);
  });

  it('loads blocks for the visible day in the practice time zone', async () => {
    const existing = block('existing');
    mockFetch.mockResolvedValue([existing]);
    const date = new Date('2026-09-26T12:00:00.000Z');
    const { result } = renderHook(() => useCalendarBlocks('day', date, date));

    await waitFor(() => expect(result.current.blocks).toEqual([existing]));
    // Midnight to midnight in Europe/Berlin (UTC+2 in September).
    expect(mockFetch).toHaveBeenCalledWith(
      'org-1',
      new Date('2026-09-25T22:00:00.000Z'),
      new Date('2026-09-26T22:00:00.000Z')
    );
  });

  it('bounds a week across the clocks going back and hides blocks outside it', async () => {
    const inside = {
      ...block('inside'),
      startAt: '2026-10-25T22:00:00.000Z',
      endAt: '2026-10-25T22:30:00.000Z',
    };
    const after = {
      ...block('after'),
      startAt: '2026-10-25T23:00:00.000Z',
      endAt: '2026-10-25T23:30:00.000Z',
    };
    mockFetch.mockResolvedValue([inside, after]);
    const weekStart = new Date(2026, 9, 19);
    const { result } = renderHook(() => useCalendarBlocks('week', weekStart, weekStart));

    await waitFor(() => expect(result.current.blocks).toEqual([inside]));
    // Sunday 25 October ends at 23:00Z once Berlin is back on UTC+1.
    expect(mockFetch).toHaveBeenCalledWith(
      'org-1',
      new Date('2026-10-18T22:00:00.000Z'),
      new Date('2026-10-25T23:00:00.000Z')
    );
  });

  it('notifies when loading blocks fails', async () => {
    mockFetch.mockRejectedValue(new Error('unavailable'));
    const date = new Date('2026-09-26T12:00:00.000Z');
    renderHook(() => useCalendarBlocks('day', date, date));

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('warning', {
        title: 'Calendar blocks unavailable',
        text: 'Try reloading the calendar.',
      })
    );
  });

  it('adds newly created blocks and replaces edited blocks', async () => {
    const date = new Date('2026-09-26T12:00:00.000Z');
    const { result } = renderHook(() => useCalendarBlocks('day', date, date));
    const input = {
      targetType: 'STAFF' as const,
      targetId: 'staff-1',
      startAt: '2026-09-26T09:00:00.000Z',
      endAt: '2026-09-26T10:00:00.000Z',
      reason: 'Training',
    };

    await act(async () => result.current.saveBlock(null, input));
    expect(mockCreate).toHaveBeenCalledWith('org-1', input);
    expect(result.current.blocks).toEqual([block('created')]);

    await act(async () => result.current.saveBlock('created', input));
    expect(mockUpdate).toHaveBeenCalledWith('org-1', 'created', input);
    expect(result.current.blocks).toEqual([block('updated')]);
  });

  it('removes a block after the delete succeeds', async () => {
    mockFetch.mockResolvedValue([block('existing')]);
    const date = new Date('2026-09-26T12:00:00.000Z');
    const { result } = renderHook(() => useCalendarBlocks('day', date, date));
    await waitFor(() => expect(result.current.blocks).toHaveLength(1));

    await act(async () => result.current.deleteBlock('existing'));
    expect(mockDelete).toHaveBeenCalledWith('org-1', 'existing');
    expect(result.current.blocks).toEqual([]);
  });

  it('keeps blocks hidden and skips writes when no organisation is selected', async () => {
    primaryOrgId = null;
    mockFetch.mockClear();
    const date = new Date('2026-09-26T12:00:00.000Z');
    const { result } = renderHook(() => useCalendarBlocks('day', date, date));

    expect(result.current.blocks).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
    await expect(result.current.saveBlock(null, block('new'))).rejects.toThrow(
      'No organisation selected'
    );
    await act(async () => result.current.deleteBlock('existing'));
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
