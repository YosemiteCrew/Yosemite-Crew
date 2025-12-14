export const isHttpsImageUrl = (src?: string | null): src is string => {
  if (!src) return false;
  return /^https:\/\/.+/i.test(src);
};