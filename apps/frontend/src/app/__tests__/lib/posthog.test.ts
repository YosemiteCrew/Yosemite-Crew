import { sanitizePostHogEvent } from '@/app/lib/posthog';

describe('sanitizePostHogEvent', () => {
  it('redacts sensitive top-level properties', () => {
    const event = sanitizePostHogEvent({
      event: '$autocapture',
      properties: {
        password: 'secret',
        token: 'abc',
      },
    } as any);

    expect(event?.properties?.password).toBe('[REDACTED]');
    expect(event?.properties?.token).toBe('[REDACTED]');
  });

  it('strips query strings and fragments from tracked URLs', () => {
    const event = sanitizePostHogEvent({
      event: '$pageview',
      properties: {
        $current_url: 'https://app.yosemitecrew.com/dashboard?token=abc#secret',
        $referrer: 'https://example.com/path?email=person@example.com',
      },
    } as any);

    expect(event?.properties?.$current_url).toBe('https://app.yosemitecrew.com/dashboard');
    expect(event?.properties?.$referrer).toBe('https://example.com/path');
  });
});
