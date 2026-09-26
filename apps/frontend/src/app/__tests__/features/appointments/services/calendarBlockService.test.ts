import { deleteData, getData, patchData, postData } from '@/app/services/axios';
import {
  createCalendarBlock,
  deleteCalendarBlock,
  fetchCalendarBlocks,
  updateCalendarBlock,
} from '@/app/features/appointments/services/calendarBlockService';

jest.mock('@/app/services/axios', () => ({
  deleteData: jest.fn(),
  getData: jest.fn(),
  patchData: jest.fn(),
  postData: jest.fn(),
}));

describe('calendarBlockService', () => {
  const input = {
    targetType: 'STAFF' as const,
    targetId: 'staff-1',
    startAt: '2027-01-06T11:00:00.000Z',
    endAt: '2027-01-06T12:00:00.000Z',
    reason: 'Lunch',
  };

  beforeEach(() => jest.clearAllMocks());

  it('loads blocks for an organization-scoped time range', async () => {
    (getData as jest.Mock).mockResolvedValue({ data: [] });
    const from = new Date('2027-01-06T00:00:00.000Z');
    const to = new Date('2027-01-07T00:00:00.000Z');

    await expect(fetchCalendarBlocks('org-1', from, to)).resolves.toEqual([]);
    expect(getData).toHaveBeenCalledWith('/v1/pms/organisation/org-1/calendar-blocks', {
      from: from.toISOString(),
      to: to.toISOString(),
    });
  });

  it('creates, updates, and deletes a block', async () => {
    const saved = { data: { id: 'block-1', ...input } };
    (postData as jest.Mock).mockResolvedValue(saved);
    (patchData as jest.Mock).mockResolvedValue(saved);

    await expect(createCalendarBlock('org-1', input)).resolves.toEqual(saved.data);
    await expect(updateCalendarBlock('org-1', 'block-1', input)).resolves.toEqual(saved.data);
    await deleteCalendarBlock('org-1', 'block-1');

    expect(postData).toHaveBeenCalledWith('/v1/pms/organisation/org-1/calendar-blocks', input);
    expect(patchData).toHaveBeenCalledWith(
      '/v1/pms/organisation/org-1/calendar-blocks/block-1',
      input
    );
    expect(deleteData).toHaveBeenCalledWith('/v1/pms/organisation/org-1/calendar-blocks/block-1');
  });

  it('rejects unsafe path identifiers before sending requests', async () => {
    await expect(fetchCalendarBlocks('../org', new Date(), new Date())).rejects.toThrow(
      'Invalid organisation ID'
    );
    await expect(deleteCalendarBlock('org-1', 'block/1')).rejects.toThrow(
      'Invalid calendar block ID'
    );
    expect(getData).not.toHaveBeenCalled();
    expect(deleteData).not.toHaveBeenCalled();
  });
});
