import { getUsage } from '@/app/services/developerUsage';
import { getData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
}));

const getDataMock = getData as jest.Mock;

const sampleUsage = { billingPeriod: '2026-08', callCount: 120, limit: 1000 };

describe('developerUsage service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the usage from the data envelope', async () => {
    getDataMock.mockResolvedValue({ data: { data: sampleUsage } });

    const result = await getUsage();

    expect(result).toEqual(sampleUsage);
    expect(getDataMock).toHaveBeenCalledWith('/v1/developers/usage');
  });

  it('omits the query string entirely when no period is given', async () => {
    getDataMock.mockResolvedValue({ data: { data: sampleUsage } });

    await getUsage();

    expect(getDataMock).toHaveBeenCalledWith('/v1/developers/usage');
  });

  it('passes an explicit period through as a query parameter', async () => {
    getDataMock.mockResolvedValue({ data: { data: sampleUsage } });

    await getUsage('2026-07');

    expect(getDataMock).toHaveBeenCalledWith('/v1/developers/usage?period=2026-07');
  });

  it('encodes a period containing URL-significant characters', async () => {
    getDataMock.mockResolvedValue({ data: { data: sampleUsage } });

    await getUsage('2026-07&admin=1');

    expect(getDataMock).toHaveBeenCalledWith('/v1/developers/usage?period=2026-07%26admin%3D1');
  });

  it('propagates a request failure to the caller', async () => {
    getDataMock.mockRejectedValue(new Error('network'));

    await expect(getUsage()).rejects.toThrow('network');
  });
});
