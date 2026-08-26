import { getData, putData } from '@/app/services/axios';
import {
  bookingPageApi,
  type BookingPageConfig,
} from '@/app/features/onboarding/services/bookingPageApiService';
import type { AxiosResponse } from 'axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  putData: jest.fn(),
}));

const mockGetData = getData as jest.MockedFunction<typeof getData>;
const mockPutData = putData as jest.MockedFunction<typeof putData>;

const asResponse = <T>(data: T): AxiosResponse<T> =>
  ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  }) as AxiosResponse<T>;

const config: BookingPageConfig = {
  organisationId: 'org-1',
  slug: 'park-veterinary',
  publicBookingEnabled: false,
  publicUrl: null,
  serviceIds: ['svc-1'],
  bookingWindowDays: 28,
  bufferMinutes: 10,
  autoConfirm: false,
  welcomeMessage: null,
  replyToEmail: null,
};

describe('bookingPageApi', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the configuration from the org-scoped endpoint', async () => {
    mockGetData.mockResolvedValueOnce(asResponse({ data: config }));

    await expect(bookingPageApi.getConfig('org-1')).resolves.toEqual(config);
    expect(mockGetData).toHaveBeenCalledWith('/v1/booking-page/org-1');
  });

  it('writes the configuration to the org-scoped endpoint', async () => {
    mockPutData.mockResolvedValueOnce(asResponse({ data: config }));
    const payload = {
      serviceIds: ['svc-1'],
      bookingWindowDays: 28,
      bufferMinutes: 10,
      autoConfirm: false,
      welcomeMessage: 'Hello',
      replyToEmail: 'desk@example.com',
    };

    await expect(bookingPageApi.saveConfig('org-1', payload)).resolves.toEqual(config);
    expect(mockPutData).toHaveBeenCalledWith('/v1/booking-page/org-1', payload);
  });

  it('surfaces a read failure to the caller rather than swallowing it', async () => {
    mockGetData.mockRejectedValueOnce(new Error('network'));
    await expect(bookingPageApi.getConfig('org-1')).rejects.toThrow('network');
  });

  it('surfaces a write failure to the caller rather than swallowing it', async () => {
    mockPutData.mockRejectedValueOnce(new Error('403'));
    await expect(
      bookingPageApi.saveConfig('org-1', {
        serviceIds: [],
        bookingWindowDays: 28,
        bufferMinutes: 10,
        autoConfirm: false,
        welcomeMessage: null,
        replyToEmail: null,
      })
    ).rejects.toThrow('403');
  });
});
