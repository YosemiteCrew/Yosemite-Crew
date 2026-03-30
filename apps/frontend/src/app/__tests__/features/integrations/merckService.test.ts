import {
  resolveMerckIntegration,
  normalizeMerckSearchPayload,
  isAllowedMerckUrl,
  getMerckGateway,
} from '@/app/features/integrations/services/merckService';
import { OrgIntegration } from '@/app/features/integrations/services/types';

const getDataMock = jest.fn();
const postDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  getData: (...args: any[]) => getDataMock(...args),
  postData: (...args: any[]) => postDataMock(...args),
}));

const makeIntegration = (provider: string, status?: string): OrgIntegration =>
  ({ provider, status, organisationId: 'org-1' }) as OrgIntegration;

describe('resolveMerckIntegration', () => {
  it('returns null when no MERCK_MANUALS integration exists', () => {
    const integrations = [makeIntegration('IDEXX')];
    expect(resolveMerckIntegration('org-1', integrations)).toBeNull();
  });

  it('returns null for empty integrations array', () => {
    expect(resolveMerckIntegration('org-1', [])).toBeNull();
  });

  it('returns normalized integration when MERCK_MANUALS exists', () => {
    const integrations = [makeIntegration('MERCK_MANUALS', 'enabled')];
    const result = resolveMerckIntegration('org-1', integrations);
    expect(result).not.toBeNull();
    expect(result?.provider).toBe('MERCK_MANUALS');
    expect(result?.status).toBe('enabled');
    expect(result?.organisationId).toBe('org-1');
  });

  it('normalizes unknown status to disabled', () => {
    const integrations = [makeIntegration('MERCK_MANUALS', 'ACTIVE')];
    const result = resolveMerckIntegration('org-1', integrations);
    expect(result?.status).toBe('disabled');
  });

  it('normalizes valid status strings', () => {
    for (const status of ['enabled', 'disabled', 'error', 'pending']) {
      const integrations = [makeIntegration('MERCK_MANUALS', status)];
      const result = resolveMerckIntegration('org-1', integrations);
      expect(result?.status).toBe(status);
    }
  });

  it('uses backend as default source when not provided', () => {
    const integrations = [makeIntegration('MERCK_MANUALS', 'enabled')];
    const result = resolveMerckIntegration('org-1', integrations);
    expect(result?.source).toBe('backend');
  });
});

describe('isAllowedMerckUrl', () => {
  it('allows merckvetmanual.com', () => {
    expect(isAllowedMerckUrl('https://www.merckvetmanual.com/topic/dogs')).toBe(true);
  });

  it('allows msdvetmanual.com', () => {
    expect(isAllowedMerckUrl('https://www.msdvetmanual.com/topic')).toBe(true);
  });

  it('allows merckmanuals.com', () => {
    expect(isAllowedMerckUrl('https://www.merckmanuals.com/home')).toBe(true);
  });

  it('allows msdmanuals.com', () => {
    expect(isAllowedMerckUrl('https://www.msdmanuals.com/home')).toBe(true);
  });

  it('allows subdomain of allowed domain', () => {
    expect(isAllowedMerckUrl('https://subdomain.merckvetmanual.com/page')).toBe(true);
  });

  it('disallows unknown domains', () => {
    expect(isAllowedMerckUrl('https://evil.com/page')).toBe(false);
  });

  it('disallows empty string', () => {
    expect(isAllowedMerckUrl('')).toBe(false);
  });

  it('disallows relative URLs', () => {
    expect(isAllowedMerckUrl('/relative/url')).toBe(false);
  });
});

describe('normalizeMerckSearchPayload', () => {
  const defaultParams = { audience: 'PROV' as any, language: 'en' as any, media: 'hybrid' as any };

  it('returns already-normalized payload as-is', () => {
    const payload = {
      entries: [
        {
          id: 'e1',
          title: 'Dogs',
          summaryText: 'About dogs',
          audience: 'PROV',
          primaryUrl: 'https://www.merckvetmanual.com/dogs',
          subLinks: [],
          updatedAt: null,
        },
      ],
      meta: {
        requestId: 'req-1',
        source: 'merck-live',
        updatedAt: null,
        audience: 'PROV',
        language: 'en',
        totalResults: 1,
      },
    };
    const result = normalizeMerckSearchPayload(payload, defaultParams);
    expect(result.meta.requestId).toBe('req-1');
    expect(result.entries).toHaveLength(1);
  });

  it('parses ATOM feed format', () => {
    const payload = {
      feed: {
        id: 'feed-1',
        updated: '2026-01-01',
        entry: {
          id: 'entry-1',
          title: 'Canine Health',
          summary: '<p>Summary text</p>',
          updated: '2026-01-01',
          link: 'https://www.merckvetmanual.com/canine',
        },
      },
    };

    const result = normalizeMerckSearchPayload(payload, defaultParams);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].title).toBe('Canine Health');
    expect(result.meta.source).toBe('merck-live-feed');
  });

  it('returns empty entries for empty feed', () => {
    const payload = { feed: {} };
    const result = normalizeMerckSearchPayload(payload, defaultParams);
    expect(result.entries).toHaveLength(0);
  });

  it('filters out entries without id or primaryUrl', () => {
    const payload = {
      feed: {
        entry: [
          { id: '', title: 'No ID', summary: '', link: 'https://www.merckvetmanual.com/page' },
          { id: 'e1', title: 'Valid', summary: '', link: '' },
        ],
      },
    };
    const result = normalizeMerckSearchPayload(payload, defaultParams);
    expect(result.entries).toHaveLength(0);
  });

  it('handles array of feed entries', () => {
    const payload = {
      feed: {
        entry: [
          {
            id: 'e1',
            title: 'Entry 1',
            summary: '',
            link: 'https://www.merckvetmanual.com/e1',
          },
          {
            id: 'e2',
            title: 'Entry 2',
            summary: '',
            link: 'https://www.merckvetmanual.com/e2',
          },
        ],
      },
    };
    const result = normalizeMerckSearchPayload(payload, defaultParams);
    expect(result.entries).toHaveLength(2);
  });

  it('uses params audience when feed has no category info', () => {
    const payload = { feed: { entry: [] } };
    const result = normalizeMerckSearchPayload(payload, {
      ...defaultParams,
      audience: 'PAT' as any,
    });
    expect(result.meta.audience).toBe('PAT');
  });

  it('uses params language when meta language is es', () => {
    const payload = {
      entries: [],
      meta: {
        requestId: 'r1',
        source: 's',
        updatedAt: null,
        audience: 'PROV',
        language: 'es',
        totalResults: 0,
      },
    };
    const result = normalizeMerckSearchPayload(payload, {
      ...defaultParams,
      language: 'es' as any,
    });
    // meta.language is 'es' so it stays as 'es'
    expect(result.meta.language).toBe('es');
  });

  it('applies media mode to entries', () => {
    const payload = {
      entries: [
        {
          id: 'e1',
          title: 'Dogs',
          summaryText: '',
          audience: 'PROV',
          primaryUrl: 'https://www.merckvetmanual.com/dogs',
          subLinks: [],
          updatedAt: null,
        },
      ],
      meta: {
        requestId: 'r1',
        source: 'merck-live',
        updatedAt: null,
        audience: 'PROV',
        language: 'en',
        totalResults: 1,
      },
    };
    const result = normalizeMerckSearchPayload(payload, {
      ...defaultParams,
      media: 'mobile' as any,
    });
    expect(result.entries[0].primaryUrl).toContain('media=mobile');
  });
});

describe('normalizeMerckSearchPayload - additional branches', () => {
  const defaultParams = { audience: 'PROV' as any, language: 'en' as any, media: 'hybrid' as any };

  it('handles meta audience as PAT', () => {
    const payload = {
      entries: [],
      meta: {
        requestId: 'r1',
        source: 's',
        updatedAt: null,
        audience: 'PAT',
        language: 'en',
        totalResults: 0,
      },
    };
    const result = normalizeMerckSearchPayload(payload, defaultParams);
    expect(result.meta.audience).toBe('PAT');
  });

  it('handles meta requestId as missing (uses fallback)', () => {
    const payload = {
      entries: [],
      meta: {
        requestId: null,
        source: null,
        updatedAt: null,
        audience: 'PROV',
        language: 'en',
        totalResults: 0,
      },
    };
    const result = normalizeMerckSearchPayload(payload, defaultParams);
    expect(typeof result.meta.requestId).toBe('string');
    expect(result.meta.source).toBe('merck-live');
  });

  it('computes totalResults from entries.length when meta.totalResults missing', () => {
    const payload = {
      entries: [
        {
          id: 'e1',
          title: 'T1',
          summaryText: '',
          audience: 'PROV',
          primaryUrl: 'https://www.merckvetmanual.com/e1',
          subLinks: [],
          updatedAt: null,
        },
      ],
      meta: {
        requestId: 'r1',
        source: 's',
        updatedAt: null,
        audience: 'PROV',
        language: 'en',
        totalResults: undefined,
      },
    };
    const result = normalizeMerckSearchPayload(payload as any, defaultParams);
    expect(result.meta.totalResults).toBe(1);
  });

  it('adds media=mobile query param to primaryUrl', () => {
    const payload = {
      entries: [
        {
          id: 'e1',
          title: 'T1',
          summaryText: '',
          audience: 'PROV',
          primaryUrl: 'https://www.merckvetmanual.com/dogs',
          subLinks: [],
          updatedAt: null,
        },
      ],
      meta: {
        requestId: 'r1',
        source: 'merck-live',
        updatedAt: null,
        audience: 'PROV',
        language: 'en',
        totalResults: 1,
      },
    };
    const result = normalizeMerckSearchPayload(payload, {
      ...defaultParams,
      media: 'mobile' as any,
    });
    expect(result.entries[0].primaryUrl).toContain('media=mobile');
  });

  it('handles ATOM feed with multiple entries including invalid ones', () => {
    const payload = {
      feed: {
        id: 'feed-1',
        entry: [
          { id: 'e1', title: 'Valid', summary: '', link: 'https://www.merckvetmanual.com/e1' },
          { id: '', title: 'No ID', summary: '', link: 'https://www.merckvetmanual.com/noid' },
          { id: 'e3', title: 'No URL', summary: '', link: '' },
        ],
      },
    };
    const result = normalizeMerckSearchPayload(payload, defaultParams);
    // Only the valid entry should pass filter
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('e1');
  });

  it('handles unknown payload format (no entries and no feed)', () => {
    const payload = {};
    const result = normalizeMerckSearchPayload(payload, defaultParams);
    expect(result.entries).toHaveLength(0);
  });

  it('handles feed with no id (uses fallback requestId)', () => {
    const payload = {
      feed: {
        entry: [],
      },
    };
    const result = normalizeMerckSearchPayload(payload, defaultParams);
    expect(typeof result.meta.requestId).toBe('string');
    expect(result.meta.source).toBe('merck-live-feed');
  });
});

describe('getMerckGateway', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a gateway object with search, enable, disable, getStatus', () => {
    const gateway = getMerckGateway();
    expect(typeof gateway.search).toBe('function');
    expect(typeof gateway.enable).toBe('function');
    expect(typeof gateway.disable).toBe('function');
    expect(typeof gateway.getStatus).toBe('function');
  });

  it('gateway.enable calls enable endpoint', async () => {
    postDataMock.mockResolvedValue({ data: { provider: 'MERCK_MANUALS' } });
    const gateway = getMerckGateway();
    const result = await gateway.enable('org-1');
    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/integration/pms/organisation/org-1/merck_manuals/enable'
    );
    expect(result.provider).toBe('MERCK_MANUALS');
  });

  it('gateway.disable calls disable endpoint', async () => {
    postDataMock.mockResolvedValue({ data: { provider: 'MERCK_MANUALS' } });
    const gateway = getMerckGateway();
    await gateway.disable('org-1');
    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/integration/pms/organisation/org-1/merck_manuals/disable'
    );
  });

  it('gateway.getStatus returns resolved integration', async () => {
    const integrations = [makeIntegration('MERCK_MANUALS', 'enabled')];
    const gateway = getMerckGateway();
    const result = await gateway.getStatus('org-1', integrations);
    expect(result?.provider).toBe('MERCK_MANUALS');
  });

  it('gateway.search calls search endpoint and normalizes response', async () => {
    const mockData = {
      entries: [],
      meta: {
        requestId: 'r1',
        source: 's',
        updatedAt: null,
        audience: 'PROV',
        language: 'en',
        totalResults: 0,
      },
    };
    getDataMock.mockResolvedValue({ data: mockData });

    const gateway = getMerckGateway();
    const result = await gateway.search({
      organisationId: 'org-1',
      query: 'diabetes',
      audience: 'PROV',
    } as any);

    expect(getDataMock).toHaveBeenCalledWith(
      '/v1/knowledge/pms/organisation/org-1/merck/manuals/search',
      expect.objectContaining({ q: 'diabetes', audience: 'PROV' })
    );
    expect(result.entries).toHaveLength(0);
  });
});
