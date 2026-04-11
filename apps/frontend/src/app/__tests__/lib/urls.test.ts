import { getSafeIdexxIframeUrl, getSafeImageUrl, isHttpsImageUrl } from '@/app/lib/urls';

describe('url helpers', () => {
  it('validates https image URLs', () => {
    expect(isHttpsImageUrl('https://example.com/a.png')).toBe(true);
    expect(isHttpsImageUrl('http://example.com/a.png')).toBe(false);
    expect(isHttpsImageUrl('')).toBe(false);
  });

  it('returns fallback avatar for unsafe image urls', () => {
    const result = getSafeImageUrl('javascript:alert(1)', 'dog');
    expect(result).toContain('/avatar/dog.png');
  });

  it('allows only https IDEXX or VetConnectPlus URLs for iframes', () => {
    expect(getSafeIdexxIframeUrl('https://integration.vetconnectplus.com/order/123')).toBe(
      'https://integration.vetconnectplus.com/order/123'
    );
    expect(getSafeIdexxIframeUrl('https://portal.idexx.com/path?a=1')).toBe(
      'https://portal.idexx.com/path?a=1'
    );
  });

  it('rejects dangerous schemes and untrusted hosts for iframes', () => {
    expect(getSafeIdexxIframeUrl('javascript:alert(1)')).toBe('');
    expect(getSafeIdexxIframeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(getSafeIdexxIframeUrl('https://evil.example.com/phish')).toBe('');
  });

  it('allows blob URLs only when explicitly enabled', () => {
    expect(getSafeIdexxIframeUrl('blob:https://app.yosemitecrew.com/abc')).toBe('');
    expect(
      getSafeIdexxIframeUrl('blob:https://app.yosemitecrew.com/abc', { allowBlob: true })
    ).toBe('blob:https://app.yosemitecrew.com/abc');
  });
});
