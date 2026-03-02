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

const pick = (arr?: readonly string[]) => {
  const pool = arr && arr.length > 0 ? arr : DEFAULT_IMAGES.other;
  return pool[0];
};

export const getSafeImageUrl = (src: string | null | undefined, type: ImageType): string => {
  const fallbackPool = DEFAULT_IMAGES[type] ?? DEFAULT_IMAGES.other;
  return isHttpsImageUrl(src) ? src : pick(fallbackPool);
};
