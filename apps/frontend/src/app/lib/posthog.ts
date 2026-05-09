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

const sanitizeUrl = (value: unknown) => {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }

  try {
    const url = new URL(value);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return value.split('?')[0]?.split('#')[0] ?? value;
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
