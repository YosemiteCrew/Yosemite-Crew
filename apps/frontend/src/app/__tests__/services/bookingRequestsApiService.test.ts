import { getData, patchData } from '@/app/services/axios';
import { bookingRequestsApi } from '@/app/features/organization/services/bookingRequestsApiService';
import type { AxiosResponse } from 'axios';

jest.mock('@/app/services/axios', () => ({ getData: jest.fn(), patchData: jest.fn() }));

const mockGetData = getData as jest.MockedFunction<typeof getData>;
const mockPatchData = patchData as jest.MockedFunction<typeof patchData>;

const asResponse = <T>(data: T): AxiosResponse<T> =>
  ({ data, status: 200, statusText: 'OK', headers: {}, config: {} }) as AxiosResponse<T>;

describe('bookingRequestsApi', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists requests from the org-scoped endpoint', async () => {
    mockGetData.mockResolvedValueOnce(asResponse({ data: [] }));

    await expect(bookingRequestsApi.list('org-1')).resolves.toEqual([]);
    expect(mockGetData).toHaveBeenCalledWith('/v1/booking-page/org-1/requests');
  });

  it('patches a status on the org-scoped endpoint', async () => {
    mockPatchData.mockResolvedValueOnce(asResponse({}));

    await bookingRequestsApi.setStatus('org-1', 'req-1', 'BOOKED');

    expect(mockPatchData).toHaveBeenCalledWith('/v1/booking-page/org-1/requests/req-1', {
      status: 'BOOKED',
    });
  });

  it('surfaces failures rather than swallowing them', async () => {
    mockGetData.mockRejectedValueOnce(new Error('403'));
    await expect(bookingRequestsApi.list('org-1')).rejects.toThrow('403');

    mockPatchData.mockRejectedValueOnce(new Error('404'));
    await expect(bookingRequestsApi.setStatus('org-1', 'req-1', 'DECLINED')).rejects.toThrow('404');
  });
});
