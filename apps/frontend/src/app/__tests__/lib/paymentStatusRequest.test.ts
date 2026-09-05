import { fetchPaymentStatus } from '@/app/lib/paymentStatusRequest';

describe('fetchPaymentStatus', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_BASE_URL;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  });

  it('requests the session status without a cache and returns the parsed body', async () => {
    const json = jest.fn().mockResolvedValue({ status: 'paid', total: 4250 });
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await expect(fetchPaymentStatus('cs_test_123')).resolves.toEqual({
      status: 'paid',
      total: 4250,
    });
    expect(fetchMock).toHaveBeenCalledWith('/fhir/v1/invoice/?session_id=cs_test_123', {
      cache: 'no-store',
    });
  });

  it('throws on an HTTP error instead of parsing the error payload', async () => {
    // `fetch` resolves on 4xx/5xx. Without the status check the error body would
    // parse as a status and the page would poll a broken endpoint thirty times.
    const json = jest.fn().mockResolvedValue({ message: 'no such session' });
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 404, json }) as unknown as typeof globalThis.fetch;

    await expect(fetchPaymentStatus('cs_test_missing')).rejects.toThrow(
      'Payment status lookup failed with 404'
    );
    expect(json).not.toHaveBeenCalled();
  });
});
