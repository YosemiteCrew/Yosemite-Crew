import apiClient from '@/shared/services/apiClient';
import {prescriptionApi} from '@/features/companion/services/prescriptionService';

jest.mock('@/shared/services/apiClient', () => {
  const actual = jest.requireActual('@/shared/services/apiClient');
  return {
    __esModule: true,
    ...actual,
    default: {get: jest.fn(), post: jest.fn()},
  };
});

describe('prescriptionApi', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists prescriptions with a bounded page and bearer token', async () => {
    const prescriptions = [{id: 'rx-1', patientId: 'pet-1', items: []}];
    (apiClient.get as jest.Mock).mockResolvedValue({data: {prescriptions}});

    await expect(prescriptionApi.list('token')).resolves.toEqual(prescriptions);
    expect(apiClient.get).toHaveBeenCalledWith('/v1/prescription/mobile', {
      params: {limit: 100},
      headers: expect.objectContaining({Authorization: 'Bearer token'}),
    });
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
