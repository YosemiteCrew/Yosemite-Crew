import {
  DEFAULT_START_URL,
  classifyNavigation,
  deepLinkToUrl,
  getDesktopConfig,
  isAllowedInAppPopup,
  isBlockedPath,
} from '../src/core/navigation-policy';

describe('getDesktopConfig', () => {
  test('defaults to the production PIMS signin entry point', () => {
    const config = getDesktopConfig({});

    expect(config.startUrl.href).toBe(DEFAULT_START_URL);
    expect(config.startUrl.pathname).toBe('/signin');
    expect(config.appPartition).toBe('persist:yosemitecrew-pims');
    expect(config.allowedOrigins.has('https://yosemitecrew.com')).toBe(true);
    expect(config.inAppPopupOrigins.has('https://cdn.yc.dev')).toBe(true);
  });

  test('falls back to the default start URL when the override is malformed', () => {
    const config = getDesktopConfig({ YC_DESKTOP_START_URL: 'not a url' });
    expect(config.startUrl.href).toBe(DEFAULT_START_URL);
  });

  test('supports deployment overrides from environment variables', () => {
    const config = getDesktopConfig({
      YC_DESKTOP_START_URL: 'https://staging.yosemitecrew.com/signin',
      YC_DESKTOP_ALLOWED_ORIGINS: 'https://assets.yosemitecrew.com,invalid-origin',
      YC_DESKTOP_IN_APP_POPUP_ORIGINS: 'https://docs.example.com,invalid-popup-origin',
      YC_DESKTOP_BLOCKED_PATH_PREFIXES: 'developers, mobile',
      YC_DESKTOP_PARTITION: 'persist:test-yc',
    });

    expect(config.startUrl.origin).toBe('https://staging.yosemitecrew.com');
    expect(config.allowedOrigins.has('https://staging.yosemitecrew.com')).toBe(true);
    expect(config.allowedOrigins.has('https://assets.yosemitecrew.com')).toBe(true);
    expect(config.inAppPopupOrigins.has('https://docs.example.com')).toBe(true);
    expect(config.blockedPathPrefixes).toEqual(['/developers', '/mobile']);
    expect(config.appPartition).toBe('persist:test-yc');
  });
});

describe('isAllowedInAppPopup', () => {
  const config = getDesktopConfig({});

  test('allows only same-origin or explicit document popup origins inside the desktop shell', () => {
    expect(isAllowedInAppPopup('https://yosemitecrew.com/appointments/print', config)).toBe(true);
    expect(isAllowedInAppPopup('https://cdn.yc.dev/document.pdf', config)).toBe(true);
    expect(isAllowedInAppPopup('https://example.com/phish', config)).toBe(false);
    expect(isAllowedInAppPopup('file:///etc/passwd', config)).toBe(false);
  });
});

describe('classifyNavigation', () => {
  const config = getDesktopConfig({});

  test('allows same-origin PIMS navigation inside the desktop shell', () => {
    const decision = classifyNavigation('https://yosemitecrew.com/dashboard', config);
    expect(decision.disposition).toBe('internal');
    expect(decision.reason).toBe('allowed');
  });

  test('opens developer portal routes outside the desktop shell', () => {
    const decision = classifyNavigation('https://yosemitecrew.com/developers/signup', config);
    expect(decision.disposition).toBe('external');
    expect(decision.reason).toBe('blocked-path');
  });

  test('opens non-Yosemite origins outside the desktop shell', () => {
    const decision = classifyNavigation('https://github.com/YosemiteCrew/Yosemite-Crew', config);
    expect(decision.disposition).toBe('external');
    expect(decision.reason).toBe('external-origin');
  });

  test('routes mailto/tel to the external handler', () => {
    expect(classifyNavigation('mailto:vet@example.com', config).reason).toBe('external-protocol');
    expect(classifyNavigation('tel:+1234567890', config).reason).toBe('external-protocol');
  });

  test('blocks unsupported protocols', () => {
    const decision = classifyNavigation('file:///etc/passwd', config);
    expect(decision.disposition).toBe('blocked');
    expect(decision.reason).toBe('unsupported-protocol');
  });

  test('blocks malformed URLs that cannot be parsed even against the base', () => {
    const decision = classifyNavigation('http://[', config);
    expect(decision.disposition).toBe('blocked');
    expect(decision.reason).toBe('invalid-url');
  });
});

describe('isBlockedPath', () => {
  test('matches blocked path prefixes exactly or by segment', () => {
    expect(isBlockedPath('/developers', ['/developers'])).toBe(true);
    expect(isBlockedPath('/developers/home', ['/developers'])).toBe(true);
    expect(isBlockedPath('/developers-preview', ['/developers'])).toBe(false);
  });
});

describe('deepLinkToUrl', () => {
  const config = getDesktopConfig({});

  test('maps a yosemitecrew:// deep link to the matching PIMS page', () => {
    expect(deepLinkToUrl('yosemitecrew://appointments/123', config)).toBe(
      'https://www.yosemitecrew.com/appointments/123'
    );
    expect(deepLinkToUrl('yosemitecrew://inbox?tab=unread', config)).toBe(
      'https://www.yosemitecrew.com/inbox?tab=unread'
    );
  });

  test('maps the bare scheme to the start origin root', () => {
    expect(deepLinkToUrl('yosemitecrew://', config)).toBe('https://www.yosemitecrew.com/');
  });

  test('preserves hash fragments in deep links', () => {
    expect(deepLinkToUrl('yosemitecrew://records#vitals', config)).toBe(
      'https://www.yosemitecrew.com/records#vitals'
    );
  });

  test('rejects deep links that resolve to blocked or non-deep-link targets', () => {
    expect(deepLinkToUrl('yosemitecrew://developers/home', config)).toBeNull();
    expect(deepLinkToUrl('https://yosemitecrew.com/dashboard', config)).toBeNull();
    expect(deepLinkToUrl('not a url', config)).toBeNull();
  });
});
