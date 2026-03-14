import { getData, postData } from '@/app/services/axios';
import {
  IntegrationProvider,
  IntegrationStatus,
  MerckAudience,
  MerckEntry,
  MerckSearchRequest,
  MerckSearchResponse,
  OrgIntegration,
} from '@/app/features/integrations/services/types';

const MERCK_PROVIDER: IntegrationProvider = 'MERCK_MANUALS';

const normalizeIntegrationStatus = (value?: string | null): IntegrationStatus => {
  const key = String(value ?? '')
    .trim()
    .toLowerCase();
  if (key === 'enabled' || key === 'disabled' || key === 'error' || key === 'pending') {
    return key;
  }
  return 'disabled';
};

export const resolveMerckIntegration = (
  organisationId: string,
  integrations: OrgIntegration[]
): OrgIntegration | null => {
  const existing = integrations.find((integration) => integration.provider === MERCK_PROVIDER);
  if (!existing) return null;

  return {
    ...existing,
    organisationId,
    provider: MERCK_PROVIDER,
    status: normalizeIntegrationStatus(existing.status),
    source: existing.source ?? 'backend',
  };
};

const applyMediaMode = (url: string, media: string) => {
  try {
    const parsed = new URL(url);
    // `content=summary` opens a truncated page with a "Read more" step.
    // Drop it so iframe opens full content and anchor scrolling works directly.
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
  subLinks: entry.subLinks.map((subLink) => ({
    ...subLink,
    url: applyMediaMode(subLink.url, media),
  })),
});

const stripHtml = (value: string): string =>
  String(value ?? '')
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();

const extractSummaryTextFromHtml = (html: string): string => {
  const firstParagraphMatch = String(html ?? '').match(/<p[^>]*>(.*?)<\/p>/i);
  if (firstParagraphMatch?.[1]) {
    return stripHtml(firstParagraphMatch[1]);
  }
  return stripHtml(html);
};

const readTextNode = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const text = String((value as { '#text'?: string })['#text'] ?? '').trim();
    if (text) return text;
  }
  return '';
};

const readHrefNode = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const href = String((value as { '@href'?: string })['@href'] ?? '').trim();
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
  const anchors: Array<{ label: string; url: string }> = [];
  const regex = /<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  do {
    match = regex.exec(html);
    if (!match) continue;
    const url = String(match[1] ?? '').trim();
    const label = stripHtml(String(match[2] ?? '')).trim();
    if (!url || !label) continue;
    anchors.push({ label, url });
  } while (match);
  return anchors;
};

const canonicalUrlKey = (value: string): string => {
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.replaceAll(/\/+$/g, '') || '/';
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}?${parsed.searchParams.toString()}#${parsed.hash.replace(/^#/, '')}`;
  } catch {
    return value.trim();
  }
};

const dedupeAndOrderSubLinks = (
  primaryUrl: string,
  links: Array<{ label: string; url: string }>
): Array<{ label: string; url: string }> => {
  const seen = new Set<string>();
  const ordered: Array<{ label: string; url: string }> = [];
  const primaryKey = canonicalUrlKey(primaryUrl);

  // Canonical first action for consistent UX across payload shapes.
  ordered.push({ label: 'Full Summary', url: primaryUrl });
  seen.add(primaryKey);

  links.forEach((link) => {
    const label = String(link.label ?? '').trim();
    const url = String(link.url ?? '').trim();
    if (!label || !url) return;

    const key = canonicalUrlKey(url);
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push({ label, url });
  });

  return ordered;
};

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
  link?: unknown;
};

type RawMerckPayload = {
  feed?: RawAtomFeed;
};

const inferAudienceFromFeedCategories = (feed?: RawAtomFeed): MerckAudience | null => {
  const categories = ensureArray(
    feed?.category as Array<Record<string, string>> | Record<string, string>
  );
  const recipient = categories.find(
    (category) => String(category?.['@scheme'] ?? '').toLowerCase() === 'informationrecipient'
  );
  const term = String(recipient?.['@term'] ?? '').toUpperCase();
  if (term === 'PAT' || term === 'PROV') return term;
  return null;
};

const toMerckEntryFromRawAtom = (
  entry: RawAtomEntry,
  audience: MerckAudience
): MerckEntry | null => {
  const id = String(entry.id ?? '').trim();
  const title = readTextNode(entry.title) || 'Manual topic';
  const summaryHtml = readTextNode(entry.summary);
  const summaryText = extractSummaryTextFromHtml(summaryHtml);
  const primaryUrl = readHrefNode(entry.link);
  if (!id || !primaryUrl) return null;
  const subLinks = dedupeAndOrderSubLinks(primaryUrl, extractAnchorLinksFromHtml(summaryHtml));
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

export const normalizeMerckSearchPayload = (
  payload: unknown,
  params: Pick<MerckSearchRequest, 'audience' | 'language' | 'media'>
): MerckSearchResponse => {
  const maybeNormalized = payload as Partial<MerckSearchResponse>;
  if (Array.isArray(maybeNormalized?.entries) && maybeNormalized?.meta != null) {
    const media = params.media ?? 'hybrid';
    return {
      meta: {
        requestId: String(maybeNormalized.meta?.requestId ?? `live-${Date.now()}`),
        source: String(maybeNormalized.meta?.source ?? 'merck-live'),
        updatedAt: maybeNormalized.meta?.updatedAt ?? null,
        audience: maybeNormalized.meta?.audience === 'PAT' ? 'PAT' : params.audience,
        language: maybeNormalized.meta?.language === 'es' ? 'es' : (params.language ?? 'en'),
        totalResults: Number(maybeNormalized.meta?.totalResults ?? maybeNormalized.entries.length),
      },
      entries: (maybeNormalized.entries ?? []).map((entry) => withMediaMode(entry, media)),
    };
  }

  const rawPayload = payload as RawMerckPayload;
  const feed = rawPayload?.feed;
  const entryNodes = ensureArray(feed?.entry);
  const audience = inferAudienceFromFeedCategories(feed) ?? params.audience;
  const media = params.media ?? 'hybrid';
  const entries = entryNodes
    .map((node) => toMerckEntryFromRawAtom(node, audience))
    .filter((item): item is MerckEntry => item != null)
    .map((entry) => withMediaMode(entry, media));

  return {
    meta: {
      requestId: String(feed?.id ?? `live-${Date.now()}`),
      source: 'merck-live-feed',
      updatedAt: feed?.updated ?? null,
      audience,
      language: params.language ?? 'en',
      totalResults: entries.length,
    },
    entries,
  };
};

export const isAllowedMerckUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowedDomains = [
      'merckvetmanual.com',
      'msdvetmanual.com',
      'merckmanuals.com',
      'msdmanuals.com',
    ];
    return allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
};

export interface MerckGateway {
  search: (params: MerckSearchRequest) => Promise<MerckSearchResponse>;
  enable: (organisationId: string) => Promise<OrgIntegration>;
  disable: (organisationId: string) => Promise<OrgIntegration>;
  getStatus: (
    organisationId: string,
    integrations: OrgIntegration[]
  ) => Promise<OrgIntegration | null>;
}

class ApiMerckGateway implements MerckGateway {
  async search(params: MerckSearchRequest): Promise<MerckSearchResponse> {
    const {
      organisationId,
      query,
      audience,
      language = 'en',
      media = 'hybrid',
      code,
      codeSystem,
      displayName,
      originalText,
      subTopicCode,
      subTopicDisplay,
    } = params;

    const res = await getData<unknown>(
      `/v1/knowledge/pms/organisation/${organisationId}/merck/manuals/search`,
      {
        q: query,
        audience,
        language,
        media,
        code,
        codeSystem,
        displayName,
        originalText,
        subTopicCode,
        subTopicDisplay,
      }
    );
    return normalizeMerckSearchPayload(res.data, { audience, language, media });
  }

  async enable(organisationId: string): Promise<OrgIntegration> {
    const res = await postData<OrgIntegration>(
      `/v1/integration/pms/organisation/${organisationId}/merck_manuals/enable`
    );
    return res.data;
  }

  async disable(organisationId: string): Promise<OrgIntegration> {
    const res = await postData<OrgIntegration>(
      `/v1/integration/pms/organisation/${organisationId}/merck_manuals/disable`
    );
    return res.data;
  }

  async getStatus(
    organisationId: string,
    integrations: OrgIntegration[]
  ): Promise<OrgIntegration | null> {
    return resolveMerckIntegration(organisationId, integrations);
  }
}

const apiGateway = new ApiMerckGateway();

export const getMerckGateway = (): MerckGateway => apiGateway;
