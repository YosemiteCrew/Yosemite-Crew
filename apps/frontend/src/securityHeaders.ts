export type SecurityHeader = {
  key: string;
  value: string;
};

export const DEFAULT_DOCUMENSO_HOST = 'https://ds.yosemitecrew.com';

export const securityHeaders: SecurityHeader[] = [
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self)',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
];

const getNonceSource = (nonce?: string) => (nonce ? `'nonce-${nonce}'` : undefined);
const POSTHOG_DEFAULT_SCRIPT_HOSTS = [
  'https://us-assets.i.posthog.com',
  'https://eu-assets.i.posthog.com',
];
const POSTHOG_DEFAULT_CONNECT_HOSTS = [
  'https://us.i.posthog.com',
  'https://eu.i.posthog.com',
  'https://us-assets.i.posthog.com',
  'https://eu-assets.i.posthog.com',
];
const getPostHogHost = () => process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();

export const buildContentSecurityPolicy = ({
  nonce,
  documensoHost = DEFAULT_DOCUMENSO_HOST,
}: {
  nonce?: string;
  documensoHost?: string;
} = {}) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const nonceSource = getNonceSource(nonce);
  const styleNonceSource = isDevelopment ? undefined : nonceSource;
  const postHogHost = getPostHogHost();
  const postHogScriptHosts = [...POSTHOG_DEFAULT_SCRIPT_HOSTS, postHogHost].filter(Boolean);
  const postHogConnectHosts = [...POSTHOG_DEFAULT_CONNECT_HOSTS, postHogHost].filter(Boolean);

  return [
    "default-src 'self'",
    [
      "script-src 'self'",
      nonceSource,
      isDevelopment ? "'unsafe-eval'" : undefined,
      'https://js.stripe.com',
      'https://cal.com',
      'https://app.cal.com',
      ...postHogScriptHosts,
    ]
      .filter(Boolean)
      .join(' '),
    [
      "style-src 'self'",
      styleNonceSource,
      isDevelopment ? "'unsafe-inline'" : undefined,
      'https://fonts.googleapis.com',
    ]
      .filter(Boolean)
      .join(' '),
    [
      "style-src-elem 'self'",
      styleNonceSource,
      isDevelopment ? "'unsafe-inline'" : undefined,
      'https://fonts.googleapis.com',
    ]
      .filter(Boolean)
      .join(' '),
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://d2il6osz49gpup.cloudfront.net https://d2kyjiikho62xx.cloudfront.net https://images.unsplash.com https://plus.unsplash.com https://yosemitecrew-backend.s3.eu-central-1.amazonaws.com https://cdn.yc.dev https://laika.aitemsolutions.com",
    [
      "connect-src 'self'",
      'https://devapi.yosemitecrew.com',
      'https://api.yosemitecrew.com',
      'https://*.amazonaws.com',
      'https://cognito-idp.eu-central-1.amazonaws.com',
      'https://chat.stream-io-api.com',
      'wss://chat.stream-io-api.com',
      'https://api.stripe.com',
      'https://api.openstatus.dev',
      'https://yosemite-crew.openstatus.dev',
      ...postHogConnectHosts,
      'https://api.github.com',
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
      'https://js.stripe.com',
      'https://hooks.stripe.com',
      'https://cal.com',
      'https://app.cal.com',
      'https://*.merckvetmanual.com',
      'https://*.msdvetmanual.com',
      'https://*.merckmanuals.com',
      documensoHost,
    ]
      .filter(Boolean)
      .join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
};
