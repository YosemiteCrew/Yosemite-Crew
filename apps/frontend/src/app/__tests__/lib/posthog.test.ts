import { POSTHOG_PROPERTY_DENYLIST, sanitizePostHogEvent } from '@/app/lib/posthog';

describe('sanitizePostHogEvent', () => {
  it('redacts sensitive top-level properties', () => {
    const event = sanitizePostHogEvent({
      event: '$autocapture',
      properties: {
        password: 'secret',
        access_token: 'bearer-xyz',
      },
    } as any);

    expect(event?.properties?.password).toBe('[REDACTED]');
    expect(event?.properties?.access_token).toBe('[REDACTED]');
  });

  it('does not redact the posthog token property (it is the public project API key)', () => {
    const event = sanitizePostHogEvent({
      event: '$pageview',
      properties: {
        token: 'phc_test',
      },
    } as any);

    expect(event?.properties?.token).toBe('phc_test');
  });

  it('keeps the PostHog token property out of the SDK denylist', () => {
    expect(POSTHOG_PROPERTY_DENYLIST).toEqual(expect.arrayContaining(['password', 'access_token']));
    expect(POSTHOG_PROPERTY_DENYLIST).not.toContain('token');
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

  it('redacts share tokens carried in the path', () => {
    // A share link IS the credential - holding /card/<token> reads the record
    // without signing in - and stripping the query string does not touch it.
    const event = sanitizePostHogEvent({
      event: '$pageview',
      properties: {
        $current_url: 'https://app.yosemitecrew.com/card/s3cr3t-share-token',
        $pathname: '/card/s3cr3t-share-token',
      },
    } as any);

    expect(event?.properties?.$current_url).toBe('https://app.yosemitecrew.com/card/[redacted]');
    expect(event?.properties?.$pathname).toBe('/card/[redacted]');
    expect(JSON.stringify(event)).not.toContain('s3cr3t-share-token');
  });

  it('redacts passport share ids too', () => {
    const event = sanitizePostHogEvent({
      event: '$pageview',
      properties: { $pathname: '/passport/abc123' },
    } as any);

    expect(event?.properties?.$pathname).toBe('/passport/[redacted]');
  });

  it('leaves ordinary app paths alone', () => {
    const event = sanitizePostHogEvent({
      event: '$pageview',
      properties: { $pathname: '/appointments/appt-1' },
    } as any);

    expect(event?.properties?.$pathname).toBe('/appointments/appt-1');
  });
});
