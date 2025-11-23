const CDN_BASE = 'https://d2kyjiikho62xx.cloudfront.net/';

const isRemote = (value?: string | null): boolean => {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trimStart().toLowerCase();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
};

const UPLOAD_LOCATIONS = ['temp/uploads/', 'companion/'];
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);

const stripTrailingSlashes = (value: string): string => {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') {
    end -= 1;
  }
  return value.slice(0, end);
};

const stripLeadingSlashes = (value: string): string => {
  let start = 0;
  while (start < value.length && value[start] === '/') {
    start += 1;
  }
  return value.slice(start);
};

const trimUploadPath = (value: string): string => {
  let result = value;
  if (result.startsWith('file://')) {
    result = result.slice('file://'.length);
  }
  while (result.startsWith('/')) {
    result = result.slice(1);
  }
  result = result.replaceAll('\\', '/');
  const queryIndex = result.indexOf('?');
  const hashIndex = result.indexOf('#');
  let cutIndex = -1;
  if (queryIndex !== -1 && hashIndex !== -1) {
    cutIndex = Math.min(queryIndex, hashIndex);
  } else if (queryIndex !== -1) {
    cutIndex = queryIndex;
  } else if (hashIndex !== -1) {
    cutIndex = hashIndex;
  }
  return cutIndex === -1 ? result : result.slice(0, cutIndex);
};

const tryExtractUploadKey = (value: string): string | null => {
  const sanitized = trimUploadPath(value);
  const lower = sanitized.toLowerCase();

  for (const location of UPLOAD_LOCATIONS) {
    const idx = lower.indexOf(location);
    if (idx === -1) {
      continue;
    }
    const candidate = sanitized.slice(idx);
    const dotIdx = candidate.lastIndexOf('.');
    if (dotIdx === -1) {
      continue;
    }
    const ext = candidate.slice(dotIdx + 1).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      continue;
    }
    return candidate;
  }

  return null;
};

export const normalizeImageUri = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  if (isRemote(value)) {
    return value;
  }

  const uploadKey = tryExtractUploadKey(value);
  if (uploadKey) {
    const base = stripTrailingSlashes(CDN_BASE);
    const key = stripLeadingSlashes(uploadKey);
    return `${base}/${key}`;
  }

  // Leave other local/asset paths unchanged so local previews continue to work.
  return value;
};

// Prefer normalizeImageUri for raw strings; resolveImageSource wraps this for ImageSourcePropType.
