export type SecurityHeader = {
  key: string;
  value: string;
};

export const DEFAULT_DOCUMENSO_HOST = 'https://ds.yosemitecrew.com';

const isProductionRuntime = () => process.env.NODE_ENV === 'production';

export const buildSecurityHeaders = (isProduction = isProductionRuntime()): SecurityHeader[] => [
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // HSTS must never be sent on localhost. Safari pins it and blocks all HTTP connections
  // including hot-reload bundles, causing TLS errors on every subsequent page load.
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }]
    : []),
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self)',
  },
  {
    // Disabled intentionally: the legacy XSS auditor is deprecated and its
    // filtering can introduce side-channel/info-leak issues. The per-route
    // nonce CSP is the real XSS defence here.
    key: 'X-XSS-Protection',
    value: '0',
  },
];

export const securityHeaders: SecurityHeader[] = buildSecurityHeaders();

const getNonceSource = (nonce?: string) => (nonce ? `'nonce-${nonce}'` : undefined);
const YC_CLOUDFRONT_HOSTS = [
  'https://d2il6osz49gpup.cloudfront.net',
  'https://d2kyjiikho62xx.cloudfront.net',
];
const POSTHOG_DEFAULT_SCRIPT_HOSTS = ['https://eu-assets.i.posthog.com'];
const POSTHOG_DEFAULT_CONNECT_HOSTS = [
  'https://eu.i.posthog.com',
  'https://eu-assets.i.posthog.com',
];
const getPostHogHost = () => process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
const getAllowedPostHogHost = () => {
  const host = getPostHogHost();
  return host === 'https://eu.i.posthog.com' ? host : undefined;
};

export const buildContentSecurityPolicy = ({
  nonce,
  documensoHost = DEFAULT_DOCUMENSO_HOST,
  allowInlineScripts = false,
}: {
  nonce?: string;
  documensoHost?: string;
  allowInlineScripts?: boolean;
} = {}) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = !isProduction;
  const nonceSource = getNonceSource(nonce);
  const postHogHost = getAllowedPostHogHost();
  const postHogScriptHosts = [...POSTHOG_DEFAULT_SCRIPT_HOSTS, postHogHost].filter(Boolean);
  const postHogConnectHosts = [...POSTHOG_DEFAULT_CONNECT_HOSTS, postHogHost].filter(Boolean);

  return [
    "default-src 'self'",
    [
      "script-src 'self'",
      nonceSource,
      allowInlineScripts ? "'unsafe-inline'" : undefined,
      isDevelopment ? "'unsafe-eval'" : undefined,
      'https://js.stripe.com',
      'https://*.js.stripe.com',
      'https://connect-js.stripe.com',
      'https://cal.com',
      'https://app.cal.com',
      ...postHogScriptHosts,
    ]
      .filter(Boolean)
      .join(' '),
    ["style-src 'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']
      .filter(Boolean)
      .join(' '),
    ["style-src-elem 'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']
      .filter(Boolean)
      .join(' '),
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com https://cal.com https://app.cal.com",
    [
      "img-src 'self'",
      'data:',
      'blob:',
      ...YC_CLOUDFRONT_HOSTS,
      'https://images.unsplash.com',
      'https://plus.unsplash.com',
      'https://yosemitecrew-backend.s3.eu-central-1.amazonaws.com',
      'https://cdn.yc.dev',
      'https://laika.aitemsolutions.com',
      'https://upload.wikimedia.org',
      'https://*.stripe.com',
    ].join(' '),
    [
      "connect-src 'self'",
      'blob:',
      'https://devapi.yosemitecrew.com',
      'https://api.yosemitecrew.com',
      'https://*.amazonaws.com',
      'https://cognito-idp.eu-central-1.amazonaws.com',
      'https://chat.stream-io-api.com',
      'wss://chat.stream-io-api.com',
      'https://api.stripe.com',
      'https://connect-js.stripe.com',
      'https://places.googleapis.com',
      'https://cal.com',
      'https://app.cal.com',
      'https://api.openstatus.dev',
      'https://yosemite-crew.openstatus.dev',
      ...postHogConnectHosts,
      'https://api.github.com',
      'https://raw.githubusercontent.com',
      'https://api.iconify.design',
      'https://api.unisvg.com',
      'https://api.simplesvg.com',
      isDevelopment ? 'http:' : undefined,
      isDevelopment ? 'ws:' : undefined,
    ]
      .filter(Boolean)
      .join(' '),
    [
      "frame-src 'self'",
      'blob:',
      'https://js.stripe.com',
      'https://*.js.stripe.com',
      'https://connect-js.stripe.com',
      'https://hooks.stripe.com',
      'https://cal.com',
      'https://app.cal.com',
      'https://*.merckvetmanual.com',
      'https://*.msdvetmanual.com',
      'https://*.merckmanuals.com',
      'https://*.idexx.com',
      'https://*.vetconnectplus.com',
      ...YC_CLOUDFRONT_HOSTS,
      documensoHost,
    ]
      .filter(Boolean)
      .join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    // upgrade-insecure-requests breaks localhost in Safari. Only send in production.
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
};
