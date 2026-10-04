import apiClient from '@/shared/services/apiClient';
import {
  careReminderApi,
  MAX_CARE_REMINDER_PAGES,
} from '@/features/companion/services/careReminderService';

jest.mock('@/shared/services/apiClient', () => {
  const actual = jest.requireActual('@/shared/services/apiClient');
  return {
    __esModule: true,
    ...actual,
    default: {get: jest.fn()},
  };
});

describe('careReminderApi', () => {
  beforeEach(() => jest.resetAllMocks());

  const page = (reminders: Array<{id: string}>, nextCursor: string | null) => ({
    data: {reminders, nextCursor, hasMore: nextCursor !== null, limit: 100},
  });

  it('lists due reminders with an authenticated bounded request', async () => {
    const reminders = [{id: 'care-1'}];
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {reminders, nextCursor: null, hasMore: false, limit: 100},
    });

    await expect(careReminderApi.list('token')).resolves.toEqual(reminders);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/v1/care-reminders/mobile/due',
      {
        params: {limit: 100, cursor: undefined},
        headers: expect.objectContaining({Authorization: 'Bearer token'}),
      },
    );
  });

  it('reads every page before the screen filters to a companion', async () => {
    (apiClient.get as jest.Mock)
      .mockResolvedValueOnce(page([{id: 'care-1'}], 'c1'))
      .mockResolvedValueOnce(page([{id: 'care-2'}], null));

    await expect(careReminderApi.list('token')).resolves.toEqual([
      {id: 'care-1'},
      {id: 'care-2'},
    ]);
    expect(
      (apiClient.get as jest.Mock).mock.calls.map(call => call[1].params),
    ).toEqual([
      {limit: 100, cursor: undefined},
      {limit: 100, cursor: 'c1'},
    ]);
  });

  it('returns an empty list when the server omits reminder rows', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {nextCursor: null, hasMore: false, limit: 100},
    });
    await expect(careReminderApi.list('token')).resolves.toEqual([]);
  });

  it.each([
    ['without a cursor', {nextCursor: null, hasMore: true}],
    ['with a repeated cursor', {nextCursor: 'c1', hasMore: true}],
  ])('rejects pagination that does not advance %s', async (_case, result) => {
    (apiClient.get as jest.Mock)
      .mockResolvedValueOnce(page([], 'c1'))
      .mockResolvedValueOnce({data: {...result, reminders: [], limit: 100}});

    await expect(careReminderApi.list('token')).rejects.toThrow(
      'Care reminder pagination did not advance',
    );
  });

  it('stops when the page limit is reached instead of returning a partial list', async () => {
    (apiClient.get as jest.Mock).mockImplementation(() => {
      const pageNumber = (apiClient.get as jest.Mock).mock.calls.length;
      return Promise.resolve(page([], `c${pageNumber}`)).then(response => ({
        ...response,
        data: {
          ...response.data,
          hasMore: pageNumber <= MAX_CARE_REMINDER_PAGES,
        },
      }));
    });

    await expect(careReminderApi.list('token')).rejects.toThrow(
      'Care reminder pagination exceeded the page limit',
    );
    expect(apiClient.get).toHaveBeenCalledTimes(MAX_CARE_REMINDER_PAGES);
  });

  it('propagates request failures instead of returning a partial list', async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('Unavailable'));
    await expect(careReminderApi.list('token')).rejects.toThrow('Unavailable');
  });
});
