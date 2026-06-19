'use strict';

// Canonical production host is www; the apex redirects to it, so start on www
// to avoid a cross-origin redirect that would be treated as external.
export const DEFAULT_START_URL = 'https://www.yosemitecrew.com/signin';
// Production defaults only. Both apex and www are allowed because the site
// redirects between them; treating either as external breaks in-app sign-in.
// Non-production environments (e.g. the dev site) are opted in at runtime via
// YC_DESKTOP_ALLOWED_ORIGINS / YC_DESKTOP_START_URL so internal infrastructure
// is not hardcoded in the public source.
export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = Object.freeze([
  'https://www.yosemitecrew.com',
  'https://yosemitecrew.com',
]);
// Public CDN / integration endpoints the web app opens documents and embeds
// from. Extend at runtime with YC_DESKTOP_IN_APP_POPUP_ORIGINS. Anything not
// listed opens in the external browser rather than an in-app window.
export const DEFAULT_IN_APP_POPUP_ORIGINS: readonly string[] = Object.freeze([
  'https://cdn.yc.dev',
  'https://ds.yosemitecrew.com',
  'https://portal.idexx.com',
]);
export const DEFAULT_BLOCKED_PATH_PREFIXES: readonly string[] = Object.freeze([
  '/developers',
  '/dev-docs',
]);
const DEFAULT_PARTITION = 'persist:yosemitecrew-pims';
const EXTERNAL_PROTOCOLS = new Set(['mailto:', 'tel:']);
export const DEEP_LINK_PROTOCOL = 'yosemitecrew:';

export interface DesktopConfig {
  startUrl: URL;
  allowedOrigins: Set<string>;
  inAppPopupOrigins: Set<string>;
  blockedPathPrefixes: string[];
  appPartition: string;
}

export type NavigationDisposition = 'internal' | 'external' | 'blocked';

export interface NavigationDecision {
  disposition: NavigationDisposition;
  reason: string;
  url?: URL;
}

const parseCsv = (value: string | undefined): string[] =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const parseUrl = (rawUrl: string, fallbackUrl: string): URL => {
  try {
    return new URL(rawUrl);
  } catch {
    return new URL(fallbackUrl);
  }
};

const normalizeOrigin = (rawOrigin: string): string | null => {
  try {
    return new URL(rawOrigin).origin;
  } catch {
    return null;
  }
};

const normalizePathPrefix = (prefix: string): string | null => {
  const trimmed = String(prefix || '').trim();
  if (!trimmed) return null;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

export const getDesktopConfig = (env: NodeJS.ProcessEnv = process.env): DesktopConfig => {
  const startUrl = parseUrl(env.YC_DESKTOP_START_URL || DEFAULT_START_URL, DEFAULT_START_URL);
  const originOverrides = parseCsv(env.YC_DESKTOP_ALLOWED_ORIGINS)
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin));
  const popupOriginOverrides = parseCsv(env.YC_DESKTOP_IN_APP_POPUP_ORIGINS)
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin));
  const blockedPathOverrides = parseCsv(env.YC_DESKTOP_BLOCKED_PATH_PREFIXES)
    .map(normalizePathPrefix)
    .filter((prefix): prefix is string => Boolean(prefix));

  return {
    startUrl,
    allowedOrigins: new Set<string>([
      ...DEFAULT_ALLOWED_ORIGINS,
      startUrl.origin,
      ...originOverrides,
    ]),
    inAppPopupOrigins: new Set<string>([...DEFAULT_IN_APP_POPUP_ORIGINS, ...popupOriginOverrides]),
    blockedPathPrefixes:
      blockedPathOverrides.length > 0 ? blockedPathOverrides : [...DEFAULT_BLOCKED_PATH_PREFIXES],
    appPartition: env.YC_DESKTOP_PARTITION || DEFAULT_PARTITION,
  };
};

export const isBlockedPath = (pathname: string, blockedPathPrefixes: string[]): boolean =>
  blockedPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export const classifyNavigation = (
  rawUrl: string,
  config: DesktopConfig = getDesktopConfig()
): NavigationDecision => {
  let url: URL;
  try {
    url = new URL(rawUrl, config.startUrl);
  } catch {
    return { disposition: 'blocked', reason: 'invalid-url' };
  }

  if (EXTERNAL_PROTOCOLS.has(url.protocol)) {
    return { disposition: 'external', reason: 'external-protocol', url };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { disposition: 'blocked', reason: 'unsupported-protocol', url };
  }

  if (!config.allowedOrigins.has(url.origin)) {
    return { disposition: 'external', reason: 'external-origin', url };
  }

  if (isBlockedPath(url.pathname, config.blockedPathPrefixes)) {
    return { disposition: 'external', reason: 'blocked-path', url };
  }

  return { disposition: 'internal', reason: 'allowed', url };
};

export const isAllowedInAppPopup = (
  rawUrl: string,
  config: DesktopConfig = getDesktopConfig()
): boolean => {
  const decision = classifyNavigation(rawUrl, config);
  if (decision.disposition === 'internal') return true;
  return Boolean(
    decision.url?.protocol === 'https:' && config.inAppPopupOrigins.has(decision.url.origin)
  );
};

// Map a yosemitecrew:// deep link to an in-app PIMS URL, or null if it does not
// resolve to an allowed internal route (so deep links can't be used to navigate
// the shell to arbitrary or developer-portal destinations).
export const deepLinkToUrl = (
  rawUrl: string,
  config: DesktopConfig = getDesktopConfig()
): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== DEEP_LINK_PROTOCOL) return null;

  const host = parsed.hostname ? `/${parsed.hostname}` : '';
  const combinedPath = `${host}${parsed.pathname || ''}`.replace(/\/{2,}/g, '/') || '/';

  let target: URL;
  try {
    target = new URL(
      `${combinedPath}${parsed.search || ''}${parsed.hash || ''}`,
      config.startUrl.origin
    );
  } catch {
    return null;
  }

  const decision = classifyNavigation(target.href, config);
  return decision.disposition === 'internal' && decision.url ? decision.url.href : null;
};
