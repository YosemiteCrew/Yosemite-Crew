import { AxiosError } from 'axios';
import {
  fetchWaitlist,
  addToWaitlist,
  offerWaitlistEntry,
  bookWaitlistEntry,
  cancelWaitlistEntry,
  type WaitlistEntry,
} from '@/app/features/appointments/services/waitlistService';

const getDataMock = jest.fn();
const postDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  getData: (...args: unknown[]) => getDataMock(...args),
  postData: (...args: unknown[]) => postDataMock(...args),
}));

const entry: WaitlistEntry = {
  id: 'w-1',
  organisationId: 'org-1',
  patientId: 'p-1',
  requestedBy: null,
  preferredLeadId: null,
  appointmentType: null,
  earliestDate: null,
  latestDate: null,
  notes: null,
  status: 'WAITING',
  offeredAt: null,
  bookedAt: null,
  expiresAt: null,
  createdAt: '2026-09-01T09:00:00.000Z',
  updatedAt: '2026-09-01T09:00:00.000Z',
};

const BASE = '/v1/pms/organisation/org-1/waitlist';

describe('waitlistService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('fetches the waitlist for an org', async () => {
    getDataMock.mockResolvedValue({ data: [entry] });
    await expect(fetchWaitlist('org-1')).resolves.toEqual([entry]);
    expect(getDataMock).toHaveBeenCalledWith(BASE);
  });

  it.each(['', '../admin', 'org/other', 'https://attacker.test'])(
    'rejects an unsafe organisation id from fetch (%s)',
    async (organisationId) => {
      await expect(fetchWaitlist(organisationId)).rejects.toThrow('Invalid organisation ID');
      expect(getDataMock).not.toHaveBeenCalled();
    }
  );

  it.each(['', '../admin', 'org/other', 'https://attacker.test'])(
    'rejects an unsafe organisation id from add (%s)',
    async (organisationId) => {
      await expect(addToWaitlist(organisationId, { patientId: 'p-1' })).rejects.toThrow(
        'Invalid organisation ID'
      );
      expect(postDataMock).not.toHaveBeenCalled();
    }
  );

  it.each(['', '../admin', 'org/other', 'https://attacker.test'])(
    'rejects an unsafe organisation id from transitions (%s)',
    async (organisationId) => {
      await expect(offerWaitlistEntry(organisationId, 'w-1')).rejects.toThrow(
        'Invalid organisation ID'
      );
      expect(postDataMock).not.toHaveBeenCalled();
    }
  );

  it('returns [] and warns when the response is not an array', async () => {
    getDataMock.mockResolvedValue({ data: { nope: true } });
    await expect(fetchWaitlist('org-1')).resolves.toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it('logs the axios message and rethrows on a fetch failure', async () => {
    const err = new AxiosError('boom');
    err.response = { data: { message: 'nope' } } as AxiosError['response'];
    getDataMock.mockRejectedValue(err);
    await expect(fetchWaitlist('org-1')).rejects.toBe(err);
    expect(console.error).toHaveBeenCalledWith('Failed to load waitlist:', 'nope');
  });

  it('logs a non-axios error verbatim and rethrows', async () => {
    const err = new Error('raw');
    getDataMock.mockRejectedValue(err);
    await expect(fetchWaitlist('org-1')).rejects.toBe(err);
    expect(console.error).toHaveBeenCalledWith('Failed to load waitlist:', err);
  });

  it('adds an entry', async () => {
    postDataMock.mockResolvedValue({ data: entry });
    await expect(addToWaitlist('org-1', { patientId: 'p-1' })).resolves.toEqual(entry);
    expect(postDataMock).toHaveBeenCalledWith(BASE, { patientId: 'p-1' });
  });

  it('rethrows when add fails', async () => {
    postDataMock.mockRejectedValue(new Error('x'));
    await expect(addToWaitlist('org-1', { patientId: 'p-1' })).rejects.toThrow('x');
    expect(console.error).toHaveBeenCalled();
  });

  it.each([
    ['offer', offerWaitlistEntry],
    ['book', bookWaitlistEntry],
    ['cancel', cancelWaitlistEntry],
  ] as const)('posts the %s transition', async (action, fn) => {
    postDataMock.mockResolvedValue({ data: { ...entry, status: 'OFFERED' } });
    await fn('org-1', 'w-1');
    expect(postDataMock).toHaveBeenCalledWith(`${BASE}/w-1/${action}`);
  });

  it.each(['', '../admin', 'entry/other', 'https://attacker.test'])(
    'rejects an unsafe waitlist entry id (%s)',
    async (entryId) => {
      await expect(offerWaitlistEntry('org-1', entryId)).rejects.toThrow(
        'Invalid waitlist entry ID'
      );
      expect(postDataMock).not.toHaveBeenCalled();
    }
  );

  it('rethrows and logs when a transition fails', async () => {
    postDataMock.mockRejectedValue(new Error('t'));
    await expect(cancelWaitlistEntry('org-1', 'w-1')).rejects.toThrow('t');
    expect(console.error).toHaveBeenCalledWith(
      'Failed to cancel waitlist entry:',
      expect.anything()
    );
  });
});
