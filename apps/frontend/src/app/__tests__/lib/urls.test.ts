import {
  getSafeDocumensoIframeUrl,
  getSafeIdexxIframeUrl,
  getSafeImageUrl,
  getSafePdfPreviewUrl,
  getSafeSameOriginPath,
  getSafeStripeRedirectUrl,
  isHttpsImageUrl,
} from '@/app/lib/urls';

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

  it('allows safe PDF preview URLs for workspace documents', () => {
    expect(getSafePdfPreviewUrl('https://files.test/workspace/doc.pdf')).toBe(
      'https://files.test/workspace/doc.pdf'
    );
    expect(getSafePdfPreviewUrl('/workspace/doc.pdf')).toBe('/workspace/doc.pdf');
    expect(getSafePdfPreviewUrl('http://localhost:4000/workspace/doc.pdf')).toBe(
      'http://localhost:4000/workspace/doc.pdf'
    );
    expect(getSafePdfPreviewUrl('blob:https://app.yosemitecrew.com/abc', { allowBlob: true })).toBe(
      'blob:https://app.yosemitecrew.com/abc'
    );
  });

  it('rejects unsafe PDF preview URLs', () => {
    expect(getSafePdfPreviewUrl('javascript:alert(1)')).toBe('');
    expect(getSafePdfPreviewUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(getSafePdfPreviewUrl('http://evil.example.com/doc.pdf')).toBe('');
    expect(getSafePdfPreviewUrl('//evil.example.com/doc.pdf')).toBe('');
    expect(getSafePdfPreviewUrl('/path\\with\\backslash')).toBe('');
    expect(getSafePdfPreviewUrl('blob:https://app.yosemitecrew.com/abc')).toBe('');
  });

  it('allows only configured Documenso https URLs for iframes', () => {
    expect(getSafeDocumensoIframeUrl('https://ds.yosemitecrew.com//sign//abc?mode=embedded')).toBe(
      'https://ds.yosemitecrew.com/sign/abc?mode=embedded'
    );
  });

  it('rejects unsafe or untrusted Documenso iframe URLs', () => {
    expect(getSafeDocumensoIframeUrl('javascript:alert(1)')).toBe('');
    expect(getSafeDocumensoIframeUrl('https://evil.example.com/sign/abc')).toBe('');
  });

  it('allows only https Stripe-host redirect URLs', () => {
    expect(getSafeStripeRedirectUrl('https://billing.stripe.com/p/session/abc')).toBe(
      'https://billing.stripe.com/p/session/abc'
    );
    expect(getSafeStripeRedirectUrl('https://checkout.stripe.com/c/pay/cs_test_1')).toBe(
      'https://checkout.stripe.com/c/pay/cs_test_1'
    );
  });

  it('rejects non-https, non-Stripe, or malformed redirect URLs', () => {
    expect(getSafeStripeRedirectUrl('http://billing.stripe.com/p/session/abc')).toBe('');
    expect(getSafeStripeRedirectUrl('https://evil.example.com/p/session/abc')).toBe('');
    expect(getSafeStripeRedirectUrl('https://stripe.com.evil.example.com/x')).toBe('');
    expect(getSafeStripeRedirectUrl('javascript:alert(1)')).toBe('');
    expect(getSafeStripeRedirectUrl('')).toBe('');
    expect(getSafeStripeRedirectUrl(null)).toBe('');
  });

  it('allows safe same-origin paths only', () => {
    expect(getSafeSameOriginPath('/appointments?appointmentId=abc')).toBe(
      '/appointments?appointmentId=abc'
    );
    expect(getSafeSameOriginPath('/tasks?taskId=t1')).toBe('/tasks?taskId=t1');
  });

  it('rejects paths that could escape the origin', () => {
    expect(getSafeSameOriginPath('//evil.example.com')).toBe('');
    expect(getSafeSameOriginPath('https://evil.example.com')).toBe('');
    expect(getSafeSameOriginPath('javascript:alert(1)')).toBe('');
    expect(getSafeSameOriginPath('/path:with:colon')).toBe('');
    expect(getSafeSameOriginPath('/path\\with\\backslash')).toBe('');
    expect(getSafeSameOriginPath('relative/no/leading/slash')).toBe('');
    expect(getSafeSameOriginPath('')).toBe('');
    expect(getSafeSameOriginPath(undefined)).toBe('');
  });
});
