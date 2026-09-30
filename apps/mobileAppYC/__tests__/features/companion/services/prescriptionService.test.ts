import apiClient from '@/shared/services/apiClient';
import {
  MAX_PRESCRIPTION_PAGES,
  prescriptionApi,
} from '@/features/companion/services/prescriptionService';

jest.mock('@/shared/services/apiClient', () => {
  const actual = jest.requireActual('@/shared/services/apiClient');
  return {
    __esModule: true,
    ...actual,
    default: {get: jest.fn(), post: jest.fn()},
  };
});

describe('prescriptionApi', () => {
  beforeEach(() => jest.resetAllMocks());

  const page = (
    prescriptions: Array<{id: string; patientId: string}>,
    nextCursor: string | null,
  ) => ({data: {prescriptions, nextCursor, hasMore: nextCursor !== null}});

  it('lists prescriptions with a bounded page and bearer token', async () => {
    const prescriptions = [{id: 'rx-1', patientId: 'pet-1', items: []}];
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {prescriptions, nextCursor: null, hasMore: false, limit: 100},
    });

    await expect(prescriptionApi.list('token')).resolves.toEqual(prescriptions);
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/v1/prescription/mobile', {
      params: {limit: 100},
      headers: expect.objectContaining({Authorization: 'Bearer token'}),
    });
  });

  // The page spans every companion the owner has, and the screen filters to
  // one. A companion whose rows all sit past page 1 must still get them.
  it('follows nextCursor while hasMore so later pages are not dropped', async () => {
    (apiClient.get as jest.Mock)
      .mockResolvedValueOnce(page([{id: 'rx-1', patientId: 'pet-2'}], 'c1'))
      .mockResolvedValueOnce(page([{id: 'rx-2', patientId: 'pet-2'}], 'c2'))
      .mockResolvedValueOnce(page([{id: 'rx-3', patientId: 'pet-1'}], null));

    const result = await prescriptionApi.list('token');

    expect(result.map(item => item.id)).toEqual(['rx-1', 'rx-2', 'rx-3']);
    expect(
      (apiClient.get as jest.Mock).mock.calls.map(call => call[1].params),
    ).toEqual([
      {limit: 100, cursor: undefined},
      {limit: 100, cursor: 'c1'},
      {limit: 100, cursor: 'c2'},
    ]);
  });

  it('treats a missing prescriptions array as an empty page', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {nextCursor: null, hasMore: false},
    });
    await expect(prescriptionApi.list('token')).resolves.toEqual([]);
  });

  it('throws instead of returning a partial list when hasMore has no cursor', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: {prescriptions: [], nextCursor: null, hasMore: true},
    });
    await expect(prescriptionApi.list('token')).rejects.toThrow(
      'Prescription pagination did not advance',
    );
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('throws instead of looping when the cursor does not advance', async () => {
    (apiClient.get as jest.Mock)
      .mockResolvedValueOnce(page([], 'c1'))
      .mockResolvedValueOnce(page([], 'c1'));
    await expect(prescriptionApi.list('token')).rejects.toThrow(
      'Prescription pagination did not advance',
    );
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  // Every page advances the cursor, so only the page cap stops the requests.
  // The fake server ends the list one page past the cap, so a missing cap
  // shows up as a resolved list rather than a hung test.
  const answerPages = (lastPage: number) =>
    (apiClient.get as jest.Mock).mockImplementation(() => {
      const n = (apiClient.get as jest.Mock).mock.calls.length;
      return Promise.resolve(
        page(
          [{id: `rx-${n}`, patientId: 'pet-1'}],
          n < Math.min(lastPage, MAX_PRESCRIPTION_PAGES + 1) ? `c${n}` : null,
        ),
      );
    });

  it('reads up to the page limit when the last page ends the list', async () => {
    answerPages(MAX_PRESCRIPTION_PAGES);
    const result = await prescriptionApi.list('token');
    expect(result).toHaveLength(MAX_PRESCRIPTION_PAGES);
    expect(apiClient.get).toHaveBeenCalledTimes(MAX_PRESCRIPTION_PAGES);
  });

  it('throws instead of requesting forever when every page reports more', async () => {
    answerPages(Number.POSITIVE_INFINITY);
    await expect(prescriptionApi.list('token')).rejects.toThrow(
      'Prescription pagination exceeded the page limit',
    );
    expect(apiClient.get).toHaveBeenCalledTimes(MAX_PRESCRIPTION_PAGES);
  });

  it('posts a refill request without putting the token in the URL', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({status: 201});

    await prescriptionApi.requestRefill('rx/1', 'token');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/v1/prescription/mobile/rx%2F1/refill',
      undefined,
      {headers: expect.objectContaining({Authorization: 'Bearer token'})},
    );
    expect((apiClient.post as jest.Mock).mock.calls[0][0]).not.toContain(
      'token',
    );
  });

  it('propagates refill failures', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(new Error('Forbidden'));
    await expect(
      prescriptionApi.requestRefill('rx-1', 'token'),
    ).rejects.toThrow('Forbidden');
  });
});
