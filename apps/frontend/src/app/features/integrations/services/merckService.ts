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
const MERCK_STATUS_STORAGE_KEY = 'yc:merck:statusByOrg';

const DEFAULT_MERCK_STATUS: IntegrationStatus = 'enabled';

const MOCK_RAW_FEED_BY_AUDIENCE: Record<MerckAudience, unknown> = {
  PROV: {
    feed: {
      id: 'tag: msdmanuals,2026-03-03/1772567449000',
      updated: '2026-03-03T07:50:49Z',
      category: [
        { '@term': 'PROV', '@scheme': 'informationRecipient' },
        { '@term': 'k58.9', '@scheme': 'mainSearchCriteria.v.c' },
      ],
      entry: [
        {
          id: '9039CD49-CC4B-4BFE-A09D-C76C54718EF9',
          title: { '#text': 'Irritable Bowel Syndrome (IBS)' },
          summary: {
            '#text':
              '<div><p>Irritable bowel syndrome is characterized by recurrent abdominal discomfort or pain with relation to defecation and bowel habit changes.</p><div><a href="https://www.msdmanuals.com/professional/gastrointestinal-disorders/irritable-bowel-syndrome-ibs/irritable-bowel-syndrome-ibs?media=print&content=summary#v896587">Etiology</a><span>-</span><a href="https://www.msdmanuals.com/professional/gastrointestinal-disorders/irritable-bowel-syndrome-ibs/irritable-bowel-syndrome-ibs?media=print&content=summary#v896604">Symptoms and Signs</a><span>-</span><a href="https://www.msdmanuals.com/professional/gastrointestinal-disorders/irritable-bowel-syndrome-ibs/irritable-bowel-syndrome-ibs?media=print&content=summary#v896608">Diagnosis</a><span>-</span><a href="https://www.msdmanuals.com/professional/gastrointestinal-disorders/irritable-bowel-syndrome-ibs/irritable-bowel-syndrome-ibs?media=print&content=summary#v896639">Treatment</a></div></div>',
          },
          updated: '2026-03-03T07:50:49Z',
          link: {
            '@href':
              'https://www.msdmanuals.com/professional/gastrointestinal-disorders/irritable-bowel-syndrome-ibs/irritable-bowel-syndrome-ibs?media=print&content=summary',
          },
        },
        {
          id: '1CC95B8E-61D0-4426-83F4-C0AF841A8492',
          title: { '#text': 'Tick-Borne Diseases in Dogs' },
          summary: {
            '#text':
              '<div><p>Tick-borne diseases in dogs can present with fever, lethargy, and thrombocytopenia.</p><div><a href="https://www.msdvetmanual.com/professional/dog-owners/infectious-diseases-of-dogs/tick-borne-diseases-in-dogs?media=print#clinical-findings">Symptoms and Signs</a><span>-</span><a href="https://www.msdvetmanual.com/professional/dog-owners/infectious-diseases-of-dogs/tick-borne-diseases-in-dogs?media=print#treatment">Treatment</a></div></div>',
          },
          updated: '2026-01-23T08:20:00Z',
          link: {
            '@href':
              'https://www.msdvetmanual.com/professional/dog-owners/infectious-diseases-of-dogs/tick-borne-diseases-in-dogs?media=print',
          },
        },
      ],
    },
  },
  PAT: {
    feed: {
      id: 'tag: msdvetmanual,2026-03-03/1772569000000',
      updated: '2026-03-03T08:10:00Z',
      category: [{ '@term': 'PAT', '@scheme': 'informationRecipient' }],
      entry: [
        {
          id: '7E8EAFBA-BB4C-4CE3-B69A-3F6D17FB18A3',
          title: { '#text': 'Digestive Upset in Dogs' },
          summary: {
            '#text':
              '<div><p>Some dogs have short episodes of digestive upset. Persistent signs should be evaluated by a veterinarian.</p><div><a href="https://www.msdvetmanual.com/dog-owners/digestive-disorders-of-dogs/digestive-upset-in-dogs?media=print#warning-signs">When to call your veterinarian</a></div></div>',
          },
          updated: '2026-02-12T06:03:31Z',
          link: {
            '@href':
              'https://www.msdvetmanual.com/dog-owners/digestive-disorders-of-dogs/digestive-upset-in-dogs?media=print',
          },
        },
      ],
    },
  },
};

const normalizeIntegrationStatus = (value?: string | null): IntegrationStatus => {
  const key = String(value ?? '')
    .trim()
    .toLowerCase();
  if (key === 'enabled' || key === 'disabled' || key === 'error' || key === 'pending') {
    return key;
  }
  return DEFAULT_MERCK_STATUS;
};

const getMerckStatusMap = (): Record<string, IntegrationStatus> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(MERCK_STATUS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.entries(parsed).reduce<Record<string, IntegrationStatus>>(
      (acc, [orgId, status]) => {
        acc[orgId] = normalizeIntegrationStatus(status);
        return acc;
      },
      {}
    );
  } catch {
    return {};
  }
};

const setMerckStatusMap = (next: Record<string, IntegrationStatus>) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MERCK_STATUS_STORAGE_KEY, JSON.stringify(next));
};

const resolveMerckMode = (): 'mock' | 'live' => {
  const raw = String(process.env.NEXT_PUBLIC_MERCK_MODE ?? '')
    .trim()
    .toLowerCase();
  return raw === 'live' ? 'live' : 'mock';
};

export const isMerckMockMode = () => resolveMerckMode() === 'mock';

export const getMerckMockStatusForOrg = (organisationId: string): IntegrationStatus => {
  const map = getMerckStatusMap();
  return map[organisationId] ?? DEFAULT_MERCK_STATUS;
};

export const setMerckMockStatusForOrg = (organisationId: string, status: IntegrationStatus) => {
  const map = getMerckStatusMap();
  map[organisationId] = status;
  setMerckStatusMap(map);
};

export const createSyntheticMerckIntegration = (organisationId: string): OrgIntegration => ({
  _id: `synthetic-merck-${organisationId}`,
  organisationId,
  provider: MERCK_PROVIDER,
  status: getMerckMockStatusForOrg(organisationId),
  source: 'synthetic',
});

export const resolveMerckIntegration = (
  organisationId: string,
  integrations: OrgIntegration[]
): OrgIntegration => {
  const existing =
    integrations.find((integration) => integration.provider === MERCK_PROVIDER) ??
    createSyntheticMerckIntegration(organisationId);

  const status = isMerckMockMode()
    ? getMerckMockStatusForOrg(organisationId)
    : normalizeIntegrationStatus(existing.status);

  return {
    ...existing,
    organisationId,
    provider: MERCK_PROVIDER,
    status,
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
    return (
      host.endsWith('merckvetmanual.com') ||
      host.endsWith('msdvetmanual.com') ||
      host.endsWith('merckmanuals.com') ||
      host.endsWith('msdmanuals.com')
    );
  } catch {
    return false;
  }
};

export interface MerckGateway {
  search: (params: MerckSearchRequest) => Promise<MerckSearchResponse>;
  enable: (organisationId: string) => Promise<OrgIntegration>;
  disable: (organisationId: string) => Promise<OrgIntegration>;
  getStatus: (organisationId: string, integrations: OrgIntegration[]) => Promise<OrgIntegration>;
}

class MockMerckGateway implements MerckGateway {
  async search(params: MerckSearchRequest): Promise<MerckSearchResponse> {
    const query = params.query.trim().toLowerCase();
    const normalized = normalizeMerckSearchPayload(MOCK_RAW_FEED_BY_AUDIENCE[params.audience], {
      audience: params.audience,
      language: params.language ?? 'en',
      media: params.media ?? 'hybrid',
    });
    const entries = normalized.entries.filter((entry) => {
      if (!query) return true;
      return (
        entry.title.toLowerCase().includes(query) ||
        entry.summaryText.toLowerCase().includes(query) ||
        entry.subLinks.some((link) => link.label.toLowerCase().includes(query))
      );
    });

    return {
      meta: {
        requestId: normalized.meta.requestId || `mock-${Date.now()}`,
        source: 'mock-merck-gateway',
        updatedAt: normalized.meta.updatedAt ?? new Date().toISOString(),
        audience: params.audience,
        language: params.language ?? 'en',
        totalResults: entries.length,
      },
      entries,
    };
  }

  async enable(organisationId: string): Promise<OrgIntegration> {
    setMerckMockStatusForOrg(organisationId, 'enabled');
    return createSyntheticMerckIntegration(organisationId);
  }

  async disable(organisationId: string): Promise<OrgIntegration> {
    setMerckMockStatusForOrg(organisationId, 'disabled');
    return createSyntheticMerckIntegration(organisationId);
  }

  async getStatus(organisationId: string, integrations: OrgIntegration[]): Promise<OrgIntegration> {
    return resolveMerckIntegration(organisationId, integrations);
  }
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

  async getStatus(organisationId: string, integrations: OrgIntegration[]): Promise<OrgIntegration> {
    return resolveMerckIntegration(organisationId, integrations);
  }
}

const mockGateway = new MockMerckGateway();
const apiGateway = new ApiMerckGateway();

export const getMerckGateway = (): MerckGateway => (isMerckMockMode() ? mockGateway : apiGateway);
