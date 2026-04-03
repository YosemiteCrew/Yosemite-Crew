import { http } from '@/app/services/http/client';
import { HttpError } from '@/app/services/http/errors';
import api from '@/app/services/axios';
import axios from 'axios';

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockApi = api as jest.Mocked<typeof api>;

const successRes = { data: { ok: true }, status: 200 };

describe('http client', () => {
  beforeEach(() => jest.clearAllMocks());

  it('get returns unwrapped data and status', async () => {
    mockApi.get.mockResolvedValue(successRes);
    const result = await http.get('/test');
    expect(result).toEqual({ data: { ok: true }, status: 200 });
  });

  it('post returns unwrapped data and status', async () => {
    mockApi.post.mockResolvedValue({ data: { id: 1 }, status: 201 });
    const result = await http.post('/test', { name: 'foo' });
    expect(result).toEqual({ data: { id: 1 }, status: 201 });
  });

  it('put returns unwrapped data', async () => {
    mockApi.put.mockResolvedValue({ data: { updated: true }, status: 200 });
    const result = await http.put('/test', { x: 1 });
    expect(result.data).toEqual({ updated: true });
  });

  it('patch returns unwrapped data', async () => {
    mockApi.patch.mockResolvedValue({ data: { patched: true }, status: 200 });
    const result = await http.patch('/test', { x: 1 });
    expect(result.data).toEqual({ patched: true });
  });

  it('delete returns unwrapped data', async () => {
    mockApi.delete.mockResolvedValue({ data: null, status: 204 });
    const result = await http.delete('/test');
    expect(result.status).toBe(204);
  });

  it('get throws normalized HttpError on axios error', async () => {
    const axiosError = Object.assign(new Error('Network Error'), {
      isAxiosError: true,
      response: { status: 500, data: { message: 'server error' } },
      code: 'ERR_NETWORK',
    });
    mockApi.get.mockRejectedValue(axiosError);
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    await expect(http.get('/fail')).rejects.toBeInstanceOf(HttpError);
  });

  it('post throws normalized HttpError on error', async () => {
    mockApi.post.mockRejectedValue(new Error('post failed'));
    await expect(http.post('/fail')).rejects.toBeInstanceOf(HttpError);
  });

  it('put throws normalized HttpError on error', async () => {
    mockApi.put.mockRejectedValue(new Error('put failed'));
    await expect(http.put('/fail')).rejects.toBeInstanceOf(HttpError);
  });

  it('patch throws normalized HttpError on error', async () => {
    mockApi.patch.mockRejectedValue(new Error('patch failed'));
    await expect(http.patch('/fail')).rejects.toBeInstanceOf(HttpError);
  });

  it('delete throws normalized HttpError on error', async () => {
    mockApi.delete.mockRejectedValue(new Error('delete failed'));
    await expect(http.delete('/fail')).rejects.toBeInstanceOf(HttpError);
  });
});
