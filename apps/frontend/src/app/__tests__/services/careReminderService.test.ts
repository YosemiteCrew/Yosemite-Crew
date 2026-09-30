import { getData, postData } from '@/app/services/axios';
import {
  createCareReminders,
  listCareReminders,
  sendCareReminder,
} from '@/app/services/careReminderService';

jest.mock('@/app/services/axios', () => ({ getData: jest.fn(), postData: jest.fn() }));

const getDataMock = getData as jest.Mock;
const postDataMock = postData as jest.Mock;

describe('careReminderService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists organization reminders from the clinical endpoint', async () => {
    const reminders = [{ id: 'r1' }];
    getDataMock.mockResolvedValue({ data: reminders });
    await expect(listCareReminders('org/1')).resolves.toEqual(reminders);
    expect(getDataMock).toHaveBeenCalledWith('/v1/pms/organisation/org%2F1/care-reminders');
  });

  it('creates an org-scoped bulk schedule', async () => {
    postDataMock.mockResolvedValue({ data: { created: 2 } });
    const input = {
      patientIds: ['p1', 'p2'],
      reminderType: 'ANNUAL_CHECKUP' as const,
      dueDate: '2026-10-01T00:00:00.000Z',
      sendAt: '2026-09-30T09:00:00.000Z',
    };
    await expect(createCareReminders('org1', input)).resolves.toEqual({ created: 2 });
    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/pms/organisation/org1/care-reminders/bulk',
      input
    );
  });

  it('sends a reminder using the org-scoped action endpoint', async () => {
    const reminder = { id: 'r/1', status: 'SENT' };
    postDataMock.mockResolvedValue({ data: reminder });
    await expect(sendCareReminder('org1', 'r/1')).resolves.toEqual(reminder);
    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/pms/organisation/org1/care-reminders/r%2F1/send',
      {}
    );
  });
});
