import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

const DEFAULT_IMAGES = {
  dog: [MEDIA_SOURCES.avatars.dog],
  cat: [MEDIA_SOURCES.avatars.cat],
  horse: [MEDIA_SOURCES.avatars.horse],
  other: [MEDIA_SOURCES.avatars.dog],
  person: [MEDIA_SOURCES.avatars.person],
  business: [MEDIA_SOURCES.avatars.business],
} as const;

export type ImageType = keyof typeof DEFAULT_IMAGES;

export const isHttpsImageUrl = (src?: string | null): src is string => {
  if (!src) return false;
  return /^https:\/\/.+/i.test(src);
};

const IDEXX_ALLOWED_HOST_SUFFIXES = ['idexx.com', 'vetconnectplus.com'] as const;
const DEFAULT_DOCUMENSO_ORIGIN = 'https://ds.yosemitecrew.com';

const hasAllowedIdexxHost = (hostname: string): boolean => {
  const normalizedHost = hostname.trim().toLowerCase();
  if (!normalizedHost) return false;
  return IDEXX_ALLOWED_HOST_SUFFIXES.some(
    (suffix) => normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`)
  );
};

export const getSafeIdexxIframeUrl = (
  src: string | null | undefined,
  options?: { allowBlob?: boolean }
): string => {
  const value = String(src ?? '').trim();
  if (!value) return '';
  if (options?.allowBlob && value.startsWith('blob:')) return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return '';
    if (!hasAllowedIdexxHost(parsed.hostname)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const getAllowedDocumensoOrigin = (): string => {
  const configuredOrigin = process.env.NEXT_PUBLIC_DOCUMENSO_HOST ?? DEFAULT_DOCUMENSO_ORIGIN;

  try {
    return new URL(configuredOrigin).origin;
  } catch {
    return DEFAULT_DOCUMENSO_ORIGIN;
  }
};

export const getSafeDocumensoIframeUrl = (src: string | null | undefined): string => {
  const value = String(src ?? '').trim();
  if (!value) return '';

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return '';
    if (parsed.origin !== getAllowedDocumensoOrigin()) return '';
    parsed.pathname = parsed.pathname.replaceAll(/\/{2,}/g, '/');
    return parsed.toString();
  } catch {
    return '';
  }
};

const pick = (arr?: readonly string[]) => {
  const pool = arr && arr.length > 0 ? arr : DEFAULT_IMAGES.other;
  return pool[0];
};

export const getSafeImageUrl = (src: string | null | undefined, type: ImageType): string => {
  const fallbackPool = DEFAULT_IMAGES[type] ?? DEFAULT_IMAGES.other;
  const value = String(src ?? '').trim();
  // Reject 'undefined'/'null' strings and paths ending in /undefined or /null
  if (!value || value === 'undefined' || value === 'null') return pick(fallbackPool);
  if (/\/(undefined|null)(\?.*)?$/.test(value)) return pick(fallbackPool);
  return isHttpsImageUrl(src) ? src : pick(fallbackPool);
};
