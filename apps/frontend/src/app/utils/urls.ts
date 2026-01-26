const DEFAULT_IMAGES = {
  dog: ["https://d2il6osz49gpup.cloudfront.net/avatar/dog.png"],
  cat: ["https://d2il6osz49gpup.cloudfront.net/avatar/cat.png"],
  horse: ["https://d2il6osz49gpup.cloudfront.net/avatar/horse.png"],
  other: ["https://d2il6osz49gpup.cloudfront.net/avatar/dog.png"],
  person: ["https://d2il6osz49gpup.cloudfront.net/avatar/parent1.png"],
  business: ["https://d2il6osz49gpup.cloudfront.net/avatar/business1.png"],
} as const;

export type ImageType = keyof typeof DEFAULT_IMAGES;

export const isHttpsImageUrl = (src?: string | null): src is string => {
  if (!src) return false;
  return /^https:\/\/.+/i.test(src);
};

const pick = (arr?: readonly string[]) => {
  const pool = arr && arr.length > 0 ? arr : DEFAULT_IMAGES.other;
  return pool[Math.floor(Math.random() * pool.length)];
};

export const getSafeImageUrl = (
  src: string | null | undefined,
  type: ImageType
): string => {
  const fallbackPool = DEFAULT_IMAGES[type] ?? DEFAULT_IMAGES.other;
  return isHttpsImageUrl(src) ? src : pick(fallbackPool);
};
