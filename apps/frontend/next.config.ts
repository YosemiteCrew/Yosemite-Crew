import type { NextConfig } from 'next';

// Self-hosted Documenso instance URL — used in frame-src so the signing portal
// iframe loads. Must be the origin only (https://sign.example.com), no path.
const documensoHost = process.env.NEXT_PUBLIC_DOCUMENSO_HOST ?? '';

const securityHeaders = [
  // Prevent clickjacking — deny all framing
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Prevent MIME-type sniffing
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Force HTTPS for 1 year, include subdomains
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  // Limit referrer info sent cross-origin
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Restrict access to sensitive browser features
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self)',
  },
  // XSS protection for older browsers
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  // Content Security Policy
  // script-src: self + inline scripts needed by Clarity/Stripe + trusted CDNs
  // style-src: self + unsafe-inline required by Tailwind runtime
  // img-src: self + all CloudFront/S3 origins used in remotePatterns + data URIs
  // connect-src: self + backend API + Cognito + Stream Chat + Stripe + Openstatus + GitHub + Iconify
  // frame-src: cal.com booking, Stripe, Merck/MSD Vet Manual reader, Documenso signing portal
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.clarity.ms https://js.stripe.com https://cal.com https://app.cal.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://d2il6osz49gpup.cloudfront.net https://d2kyjiikho62xx.cloudfront.net https://images.unsplash.com https://plus.unsplash.com https://yosemitecrew-backend.s3.eu-central-1.amazonaws.com https://cdn.yc.dev",
      "connect-src 'self' https://devapi.yosemitecrew.com https://api.yosemitecrew.com https://*.amazonaws.com https://cognito-idp.eu-central-1.amazonaws.com https://chat.stream-io-api.com wss://chat.stream-io-api.com https://api.stripe.com https://api.openstatus.dev https://yosemite-crew.openstatus.dev https://www.clarity.ms https://api.github.com https://api.iconify.design https://api.unisvg.com https://api.simplesvg.com",
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
      "form-action 'self'",
      'upgrade-insecure-requests',
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'd2il6osz49gpup.cloudfront.net' },
      { protocol: 'https', hostname: 'd2kyjiikho62xx.cloudfront.net' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      {
        protocol: 'https',
        hostname: 'yosemitecrew-backend.s3.eu-central-1.amazonaws.com',
      },
      { protocol: 'https', hostname: 'cdn.yc.dev' },
    ],
  },
  outputFileTracingExcludes: {
    'apps/frontend/**': ['**/.pnpm/**', '**/node_modules/.pnpm/**', '**/.turbo/**'],
  },
  experimental: {
    webpackMemoryOptimizations: true,
    serverSourceMaps: false,
  },
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
