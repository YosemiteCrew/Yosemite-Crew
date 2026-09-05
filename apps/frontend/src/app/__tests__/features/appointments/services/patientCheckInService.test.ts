import { AxiosError } from 'axios';
import {
  fetchCheckIns,
  fetchCheckIn,
  createCheckIn,
  markCheckInSeen,
  completeCheckIn,
  cancelCheckIn,
  markCheckInNoShow,
  assignCheckInRoom,
  type PatientCheckIn,
} from '@/app/features/appointments/services/patientCheckInService';

const getDataMock = jest.fn();
const postDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  getData: (...args: unknown[]) => getDataMock(...args),
  postData: (...args: unknown[]) => postDataMock(...args),
}));

const ORG = '11111111-1111-4111-8111-111111111111';
const CHECK_IN = '22222222-2222-4222-8222-222222222222';
const BASE = `/v1/pms/organisation/${ORG}/check-in`;

const checkIn: PatientCheckIn = {
  id: CHECK_IN,
  organisationId: ORG,
  patientId: '33333333-3333-4333-8333-333333333333',
  clientId: '44444444-4444-4444-8444-444444444444',
  appointmentId: null,
  arrivedAt: '2026-09-05T08:30:00.000Z',
  triagePriority: 'STANDARD',
  triageNote: null,
  assignedRoomId: null,
  checkedInBy: null,
  waitStartedAt: '2026-09-05T08:30:00.000Z',
  seenAt: null,
  waitMinutes: null,
  status: 'WAITING',
  notes: null,
  createdAt: '2026-09-05T08:30:00.000Z',
  updatedAt: '2026-09-05T08:30:00.000Z',
};

const UNSAFE_IDS = ['', 'not-a-uuid', '../admin', 'org/other', 'https://attacker.test'];

describe('patientCheckInService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('fetchCheckIns', () => {
    it('fetches the check-ins for an org with no filters', async () => {
      getDataMock.mockResolvedValue({ data: [checkIn] });
      await expect(fetchCheckIns(ORG)).resolves.toEqual([checkIn]);
      expect(getDataMock).toHaveBeenCalledWith(BASE, {});
    });

    it('passes the patientId and status filters as query params', async () => {
      getDataMock.mockResolvedValue({ data: [] });
      await fetchCheckIns(ORG, { patientId: 'p-9', status: 'IN_CONSULTATION' });
      expect(getDataMock).toHaveBeenCalledWith(BASE, {
        patientId: 'p-9',
        status: 'IN_CONSULTATION',
      });
    });

    it.each(UNSAFE_IDS)('rejects an unsafe organisation id (%s)', async (organisationId) => {
      await expect(fetchCheckIns(organisationId)).rejects.toThrow('Invalid organisation ID');
      expect(getDataMock).not.toHaveBeenCalled();
    });

    it('returns [] and warns when the response is not an array', async () => {
      getDataMock.mockResolvedValue({ data: { nope: true } });
      await expect(fetchCheckIns(ORG)).resolves.toEqual([]);
      expect(console.warn).toHaveBeenCalledWith('Check-in response is not an array; got', 'object');
    });

    it('logs the axios message and rethrows on failure', async () => {
      const err = new AxiosError('boom');
      err.response = { data: { message: 'nope' } } as AxiosError['response'];
      getDataMock.mockRejectedValue(err);
      await expect(fetchCheckIns(ORG)).rejects.toBe(err);
      expect(console.error).toHaveBeenCalledWith('Failed to load check-ins:', 'nope');
    });

    it('falls back to err.message for an axios error with no response', async () => {
      const err = new AxiosError('network down');
      getDataMock.mockRejectedValue(err);
      await expect(fetchCheckIns(ORG)).rejects.toBe(err);
      expect(console.error).toHaveBeenCalledWith('Failed to load check-ins:', 'network down');
    });

    it('logs a non-axios error verbatim and rethrows', async () => {
      const err = new Error('raw');
      getDataMock.mockRejectedValue(err);
      await expect(fetchCheckIns(ORG)).rejects.toBe(err);
      expect(console.error).toHaveBeenCalledWith('Failed to load check-ins:', err);
    });
  });

  describe('fetchCheckIn', () => {
    it('fetches a single check-in', async () => {
      getDataMock.mockResolvedValue({ data: checkIn });
      await expect(fetchCheckIn(ORG, CHECK_IN)).resolves.toEqual(checkIn);
      expect(getDataMock).toHaveBeenCalledWith(`${BASE}/${CHECK_IN}`);
    });

    it.each(UNSAFE_IDS)('rejects an unsafe check-in id (%s)', async (checkInId) => {
      await expect(fetchCheckIn(ORG, checkInId)).rejects.toThrow('Invalid check-in ID');
      expect(getDataMock).not.toHaveBeenCalled();
    });

    it('logs and rethrows on failure', async () => {
      getDataMock.mockRejectedValue(new Error('x'));
      await expect(fetchCheckIn(ORG, CHECK_IN)).rejects.toThrow('x');
      expect(console.error).toHaveBeenCalledWith('Failed to load the check-in:', expect.anything());
    });
  });

  describe('createCheckIn', () => {
    const payload = {
      patientId: '33333333-3333-4333-8333-333333333333',
      clientId: '44444444-4444-4444-8444-444444444444',
      arrivedAt: '2026-09-05T08:30:00.000Z',
    };

    it('creates a check-in', async () => {
      postDataMock.mockResolvedValue({ data: checkIn });
      await expect(createCheckIn(ORG, payload)).resolves.toEqual(checkIn);
      expect(postDataMock).toHaveBeenCalledWith(BASE, payload);
    });

    it.each(UNSAFE_IDS)('rejects an unsafe organisation id (%s)', async (organisationId) => {
      await expect(createCheckIn(organisationId, payload)).rejects.toThrow(
        'Invalid organisation ID'
      );
      expect(postDataMock).not.toHaveBeenCalled();
    });

    it('logs and rethrows on failure', async () => {
      postDataMock.mockRejectedValue(new Error('x'));
      await expect(createCheckIn(ORG, payload)).rejects.toThrow('x');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('transitions', () => {
    it.each([
      ['seen', markCheckInSeen],
      ['complete', completeCheckIn],
      ['cancel', cancelCheckIn],
      ['no-show', markCheckInNoShow],
    ] as const)('posts the %s transition', async (action, fn) => {
      postDataMock.mockResolvedValue({ data: { ...checkIn, status: 'IN_CONSULTATION' } });
      await fn(ORG, CHECK_IN);
      expect(postDataMock).toHaveBeenCalledWith(`${BASE}/${CHECK_IN}/${action}`);
    });

    it.each(UNSAFE_IDS)('rejects an unsafe organisation id (%s)', async (organisationId) => {
      await expect(markCheckInSeen(organisationId, CHECK_IN)).rejects.toThrow(
        'Invalid organisation ID'
      );
      expect(postDataMock).not.toHaveBeenCalled();
    });

    it.each(UNSAFE_IDS)('rejects an unsafe check-in id (%s)', async (checkInId) => {
      await expect(completeCheckIn(ORG, checkInId)).rejects.toThrow('Invalid check-in ID');
      expect(postDataMock).not.toHaveBeenCalled();
    });

    it('logs and rethrows when a transition fails', async () => {
      postDataMock.mockRejectedValue(new Error('t'));
      await expect(cancelCheckIn(ORG, CHECK_IN)).rejects.toThrow('t');
      expect(console.error).toHaveBeenCalledWith(
        'Failed to cancel the check-in:',
        expect.anything()
      );
    });
  });

  describe('assignCheckInRoom', () => {
    const ROOM = '55555555-5555-4555-8555-555555555555';

    it('posts the room assignment with the roomId body', async () => {
      postDataMock.mockResolvedValue({ data: { ...checkIn, assignedRoomId: ROOM } });
      await assignCheckInRoom(ORG, CHECK_IN, ROOM);
      expect(postDataMock).toHaveBeenCalledWith(`${BASE}/${CHECK_IN}/room`, { roomId: ROOM });
    });

    it.each(UNSAFE_IDS)('rejects an unsafe check-in id (%s)', async (checkInId) => {
      await expect(assignCheckInRoom(ORG, checkInId, ROOM)).rejects.toThrow('Invalid check-in ID');
      expect(postDataMock).not.toHaveBeenCalled();
    });

    it('logs and rethrows on failure', async () => {
      postDataMock.mockRejectedValue(new Error('x'));
      await expect(assignCheckInRoom(ORG, CHECK_IN, ROOM)).rejects.toThrow('x');
      expect(console.error).toHaveBeenCalledWith(
        'Failed to assign a room to the check-in:',
        expect.anything()
      );
    });
  });
});
