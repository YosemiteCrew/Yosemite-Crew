import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import type {
  MerckAudience,
  MerckEntry,
  MerckLanguage,
  MerckSearchRequest,
  MerckSearchResponse,
} from '@/features/merck/types';

const DEFAULT_AUDIENCE: MerckAudience = 'PAT';
const DEFAULT_LANGUAGE: MerckLanguage = 'en';
const DEFAULT_MEDIA = 'hybrid';

const ALLOWED_MERCK_HOSTS = new Set([
  'merckvetmanual.com',
  'msdvetmanual.com',
  'merckmanuals.com',
  'msdmanuals.com',
]);

const collapseWhitespace = (value: string): string => {
  let result = '';
  let previousWasWhitespace = true;

  for (const char of value) {
    const isWhitespace =
      char === ' ' ||
      char === '\n' ||
      char === '\r' ||
      char === '\t' ||
      char === '\f';
    if (isWhitespace) {
      if (!previousWasWhitespace) {
        result += ' ';
      }
      previousWasWhitespace = true;
      continue;
    }
    result += char;
    previousWasWhitespace = false;
  }

  return result.trim();
};

const stripHtml = (value: string): string => {
  const input = String(value ?? '');
  let result = '';
  let insideTag = false;

  for (const char of input) {
    if (char === '<') {
      insideTag = true;
      result += ' ';
      continue;
    }
    if (char === '>') {
      insideTag = false;
      result += ' ';
      continue;
    }
    if (!insideTag) {
      result += char;
    }
  }

  return collapseWhitespace(result);
};

const readTextNode = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const text = String((value as {'#text'?: string})['#text'] ?? '').trim();
    if (text) return text;
  }
  return '';
};

const readHrefNode = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const href = String((value as {'@href'?: string})['@href'] ?? '').trim();
    if (href) return href;
  }
  return '';
};

const ensureArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
};

const extractAnchorLinksFromHtml = (html: string) => {
  const anchors: Array<{label: string; url: string}> = [];
  const regex = /<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  do {
    match = regex.exec(html);
    if (!match) continue;
    const url = String(match[1] ?? '').trim();
    const label = stripHtml(String(match[2] ?? '')).trim();
    if (!url || !label) continue;
    anchors.push({label, url});
  } while (match);
  return anchors;
};

const canonicalUrlKey = (value: string): string => {
  try {
    const parsed = new URL(value);
    let pathname = parsed.pathname;
    while (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    const hash = parsed.hash.startsWith('#')
      ? parsed.hash.slice(1)
      : parsed.hash;
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname || '/'}?${parsed.searchParams.toString()}#${hash}`;
  } catch {
    return value.trim();
  }
};

const dedupeAndOrderSubLinks = (
  primaryUrl: string,
  links: Array<{label: string; url: string}>,
): Array<{label: string; url: string}> => {
  const seen = new Set<string>();
  const ordered: Array<{label: string; url: string}> = [];
  const primaryKey = canonicalUrlKey(primaryUrl);

  ordered.push({label: 'Full Summary', url: primaryUrl});
  seen.add(primaryKey);

  links.forEach(link => {
    const label = String(link.label ?? '').trim();
    const url = String(link.url ?? '').trim();
    if (!label || !url) return;

    const key = canonicalUrlKey(url);
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push({label, url});
  });

  return ordered;
};

const applyMediaMode = (url: string, media: string) => {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('content');
    parsed.searchParams.set('media', media);
    return parsed.toString();
  } catch {
    return url;
  }
};

const withMediaMode = (entry: MerckEntry, media: string): MerckEntry => ({
  ...entry,
  primaryUrl: applyMediaMode(entry.primaryUrl, media),
  subLinks: entry.subLinks.map(subLink => ({
    ...subLink,
    url: applyMediaMode(subLink.url, media),
  })),
});

type RawAtomEntry = {
  id?: string;
  title?: unknown;
  summary?: unknown;
  updated?: string;
  link?: unknown;
};

type RawAtomFeed = {
  id?: string;
  updated?: string;
  category?: unknown;
  entry?: RawAtomEntry | RawAtomEntry[];
};

type RawMerckPayload = {
  feed?: RawAtomFeed;
};

const inferAudienceFromFeedCategories = (feed?: RawAtomFeed): MerckAudience => {
  const categories = ensureArray(
    feed?.category as Array<Record<string, string>> | Record<string, string>,
  );
  const recipient = categories.find(
    category =>
      String(category?.['@scheme'] ?? '').toLowerCase() ===
      'informationrecipient',
  );
  const term = String(recipient?.['@term'] ?? '').toUpperCase();
  if (term === 'PAT') return 'PAT';
  return DEFAULT_AUDIENCE;
};

const toMerckEntryFromRawAtom = (
  entry: RawAtomEntry,
  audience: MerckAudience,
): MerckEntry | null => {
  const id = String(entry.id ?? '').trim();
  const title = readTextNode(entry.title) || 'Manual topic';
  const summaryHtml = readTextNode(entry.summary);
  const summaryText = stripHtml(summaryHtml);
  const primaryUrl = readHrefNode(entry.link);
  if (!id || !primaryUrl) return null;
  const subLinks = dedupeAndOrderSubLinks(
    primaryUrl,
    extractAnchorLinksFromHtml(summaryHtml),
  );
  return {
    id,
    title,
    summaryText,
    updatedAt: entry.updated ?? null,
    audience,
    primaryUrl,
    subLinks,
  };
};

const asAllowedUrl = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const isAllowed =
      ALLOWED_MERCK_HOSTS.has(host) ||
      Array.from(ALLOWED_MERCK_HOSTS).some(allowedHost =>
        host.endsWith(`.${allowedHost}`),
      );

    if (!isAllowed) {
      return null;
    }

    const path = parsed.pathname.toLowerCase();
    if (path.includes('/professional')) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
};

export const isAllowedMerckUrl = (value: string): boolean =>
  asAllowedUrl(value) !== null;

const sanitizeEntry = (entry: MerckEntry): MerckEntry | null => {
  const primaryUrl = asAllowedUrl(entry.primaryUrl);
  if (!primaryUrl) {
    return null;
  }

  const subLinks = entry.subLinks
    .map(link => {
      const allowedUrl = asAllowedUrl(link.url);
      if (!allowedUrl) {
        return null;
      }
      return {
        label: link.label,
        url: allowedUrl,
      };
    })
    .filter((link): link is {label: string; url: string} => link !== null);

  return {
    ...entry,
    audience: DEFAULT_AUDIENCE,
    primaryUrl,
    subLinks,
  };
};

export const normalizeMerckSearchPayload = (
  payload: unknown,
  params: Pick<MerckSearchRequest, 'language' | 'media'>,
): MerckSearchResponse => {
  const language = params.language ?? DEFAULT_LANGUAGE;
  const media = params.media ?? DEFAULT_MEDIA;

  const maybeNormalized = payload as Partial<MerckSearchResponse>;
  if (
    Array.isArray(maybeNormalized?.entries) &&
    maybeNormalized?.meta != null
  ) {
    const entries = maybeNormalized.entries
      .filter((entry): entry is MerckEntry => Boolean(entry))
      .map(entry => withMediaMode(entry, media))
      .map(sanitizeEntry)
      .filter((entry): entry is MerckEntry => entry !== null);

    return {
      meta: {
        requestId: maybeNormalized.meta.requestId,
        source: maybeNormalized.meta.source,
        updatedAt: maybeNormalized.meta.updatedAt ?? null,
        audience: DEFAULT_AUDIENCE,
        language,
        totalResults: entries.length,
      },
      entries,
    };
  }

  const raw = payload as RawMerckPayload;
  const feed = raw.feed;
  const audience = inferAudienceFromFeedCategories(feed);
  const entries = ensureArray(feed?.entry)
    .map(entry => toMerckEntryFromRawAtom(entry, audience))
    .filter((entry): entry is MerckEntry => entry !== null)
    .map(entry => withMediaMode(entry, media))
    .map(sanitizeEntry)
    .filter((entry): entry is MerckEntry => entry !== null);

  return {
    meta: {
      requestId: feed?.id,
      source: 'merck-live',
      updatedAt: feed?.updated ?? null,
      audience: DEFAULT_AUDIENCE,
      language,
      totalResults: entries.length,
    },
    entries,
  };
};

const toErrorMessage = (error: unknown): string => {
  const candidate = error as {
    response?: {data?: {message?: string}};
    message?: string;
  };
  return (
    candidate?.response?.data?.message ||
    candidate?.message ||
    'Unable to search Merck manuals right now.'
  );
};

export const merckApi = {
  async searchManuals({
    organisationId,
    query,
    language = DEFAULT_LANGUAGE,
    media = DEFAULT_MEDIA,
    accessToken,
  }: MerckSearchRequest & {accessToken: string}): Promise<MerckSearchResponse> {
    try {
      const {data} = await apiClient.get(
        `/v1/knowledge/pms/organisation/${encodeURIComponent(organisationId)}/merck/manuals/search`,
        {
          params: {
            q: query,
            audience: DEFAULT_AUDIENCE,
            language,
            media,
          },
          headers: withAuthHeaders(accessToken),
        },
      );

      return normalizeMerckSearchPayload(data, {
        language,
        media,
      });
    } catch (error) {
      throw new Error(toErrorMessage(error));
    }
  },
};
