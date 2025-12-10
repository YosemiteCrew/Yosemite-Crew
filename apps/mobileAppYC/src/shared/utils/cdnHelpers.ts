const CDN_BASE = 'https://d2kyjiikho62xx.cloudfront.net/';

/**
 * Strips leading and trailing slashes from a string
 */
export const stripSlashes = (value: string): string => {
  let start = 0;
  let end = value.length;

  while (start < end && value[start] === '/') {
    start += 1;
  }

  while (end > start && value[end - 1] === '/') {
    end -= 1;
  }

  return value.slice(start, end);
};

/**
 * Builds a CDN URL from a storage key
 * @param key - The storage key (e.g., 's3://bucket/path/to/file')
 * @returns The full CDN URL or null if key is invalid
 */
export const buildCdnUrlFromKey = (key?: string | null): string | null => {
  if (!key) {
    return null;
  }
  const normalizedKey = stripSlashes(key);
  const base = CDN_BASE.endsWith('/') ? CDN_BASE.slice(0, -1) : CDN_BASE;
  return `${base}/${normalizedKey}`;
};
