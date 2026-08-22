type PostHogProperties = Record<string, unknown>;
type PostHogEvent = {
  properties?: PostHogProperties;
};

export const COOKIE_CONSENT_KEY = 'cookieConsentGiven';
export const POSTHOG_READY_EVENT = 'yc:posthog-ready';

const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_PROPERTY_NAMES = new Set([
  'access_token',
  'authorization',
  'cookie',
  'id_token',
  'password',
  'refresh_token',
  // 'token' is intentionally excluded because PostHog uses properties['token'] as the
  // project API key (a public value). Redacting it strips the auth header and returns 401.
]);
export const POSTHOG_PROPERTY_DENYLIST = [...SENSITIVE_PROPERTY_NAMES];

/**
 * Path prefixes whose next segment is a bearer credential rather than an id.
 * A share link IS the credential: anyone holding `/card/<token>` can read the
 * record it points at without signing in, so the token must never leave the
 * browser inside an analytics event. Stripping the query string is not enough
 * here, because the secret is in the path.
 */
const CREDENTIAL_PATH_PREFIXES = ['card', 'passport'];
const REDACTED_PATH_SEGMENT = '[redacted]';

const redactCredentialSegments = (pathname: string): string => {
  const segments = pathname.split('/');
  // segments[0] is the empty string before the leading slash.
  for (let i = 1; i < segments.length; i++) {
    if (CREDENTIAL_PATH_PREFIXES.includes(segments[i]) && segments[i + 1]) {
      segments[i + 1] = REDACTED_PATH_SEGMENT;
    }
  }
  return segments.join('/');
};

const sanitizeUrl = (value: unknown) => {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }

  try {
    const url = new URL(value);
    url.search = '';
    url.hash = '';
    url.pathname = redactCredentialSegments(url.pathname);
    return url.toString();
  } catch {
    // Not an absolute URL: $pathname arrives as a bare path.
    const withoutQuery = value.split('?')[0]?.split('#')[0] ?? value;
    return redactCredentialSegments(withoutQuery);
  }
};

const sanitizeProperties = (properties: PostHogProperties | undefined) => {
  if (!properties) {
    return properties;
  }

  for (const key of Object.keys(properties)) {
    const normalizedKey = key.trim().toLowerCase();
    if (SENSITIVE_PROPERTY_NAMES.has(normalizedKey)) {
      properties[key] = REDACTED_VALUE;
      continue;
    }

    if (
      normalizedKey === '$current_url' ||
      normalizedKey === '$referrer' ||
      normalizedKey === '$pathname'
    ) {
      properties[key] = sanitizeUrl(properties[key]);
    }
  }

  return properties;
};

export const sanitizePostHogEvent = <T extends PostHogEvent | null>(event: T): T => {
  if (!event) {
    return event;
  }

  event.properties = sanitizeProperties(event.properties);
  return event;
};
