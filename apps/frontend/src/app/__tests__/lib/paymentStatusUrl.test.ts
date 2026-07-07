import { buildPaymentStatusUrl } from '@/app/lib/paymentStatusUrl';

describe('buildPaymentStatusUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns a relative path when no base url is configured', () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    const url = buildPaymentStatusUrl('sess_123');
    expect(url).toBe('/fhir/v1/invoice/?session_id=sess_123');
  });

  it('returns a relative path when the base url is blank', () => {
    process.env.NEXT_PUBLIC_BASE_URL = '   ';
    const url = buildPaymentStatusUrl('sess_123');
    expect(url).toBe('/fhir/v1/invoice/?session_id=sess_123');
  });

  it('builds an absolute url when the base url does not end with a slash', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://api.example.com';
    const url = buildPaymentStatusUrl('sess_123');
    expect(url).toBe('https://api.example.com/fhir/v1/invoice/?session_id=sess_123');
  });

  it('builds an absolute url when the base url already ends with a slash', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://api.example.com/';
    const url = buildPaymentStatusUrl('sess_123');
    expect(url).toBe('https://api.example.com/fhir/v1/invoice/?session_id=sess_123');
  });

  it('encodes the session id', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://api.example.com';
    const url = buildPaymentStatusUrl('sess 123/abc');
    expect(url).toContain(encodeURIComponent('sess 123/abc'));
  });
});
