import {
  createSyntheticMerckIntegration,
  getMerckMockStatusForOrg,
  isAllowedMerckUrl,
  normalizeMerckSearchPayload,
  resolveMerckIntegration,
  setMerckMockStatusForOrg,
} from '@/app/features/integrations/services/merckService';

describe('merckService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    process.env.NEXT_PUBLIC_MERCK_MODE = 'mock';
  });

  it('injects synthetic merck integration when backend provider is missing', () => {
    const resolved = resolveMerckIntegration('org-1', []);

    expect(resolved.provider).toBe('MERCK_MANUALS');
    expect(resolved.source).toBe('synthetic');
    expect(resolved.status).toBe('enabled');
  });

  it('defaults to mock mode when env is empty', () => {
    process.env.NEXT_PUBLIC_MERCK_MODE = '';
    const resolved = resolveMerckIntegration('org-1', []);
    expect(resolved.source).toBe('synthetic');
    expect(resolved.status).toBe('enabled');
  });

  it('uses local status override in mock mode', () => {
    setMerckMockStatusForOrg('org-1', 'disabled');

    const resolved = resolveMerckIntegration('org-1', []);
    expect(resolved.status).toBe('disabled');
    expect(getMerckMockStatusForOrg('org-1')).toBe('disabled');
  });

  it('retains backend integration record when available', () => {
    const resolved = resolveMerckIntegration('org-1', [
      {
        _id: 'm1',
        organisationId: 'org-1',
        provider: 'MERCK_MANUALS',
        status: 'enabled',
      },
    ] as any);

    expect(resolved._id).toBe('m1');
    expect(resolved.provider).toBe('MERCK_MANUALS');
  });

  it('creates a synthetic integration scoped to org', () => {
    const synthetic = createSyntheticMerckIntegration('org-x');
    expect(synthetic.organisationId).toBe('org-x');
    expect(synthetic.provider).toBe('MERCK_MANUALS');
  });

  it('normalizes raw feed payload into MerckSearchResponse', () => {
    const payload = {
      feed: {
        id: 'tag:msdmanuals,2026-03-03/1',
        updated: '2026-03-03T07:50:49Z',
        category: [{ '@term': 'PROV', '@scheme': 'informationRecipient' }],
        entry: [
          {
            id: '9039CD49-CC4B-4BFE-A09D-C76C54718EF9',
            title: { '#text': 'Irritable Bowel Syndrome (IBS)' },
            summary: {
              '#text':
                '<div><p>Summary text.</p><div><a href="https://www.msdmanuals.com/professional/topic?media=print&content=summary#x">Etiology</a><span>-</span><a href="https://www.msdmanuals.com/professional/topic?media=print&content=summary#x">Etiology</a></div></div>',
            },
            updated: '2026-03-03T07:50:49Z',
            link: {
              '@href': 'https://www.msdmanuals.com/professional/topic?media=print&content=summary',
            },
          },
        ],
      },
    };

    const normalized = normalizeMerckSearchPayload(payload, {
      audience: 'PROV',
      language: 'en',
      media: 'hybrid',
    });

    expect(normalized.entries).toHaveLength(1);
    expect(normalized.meta.audience).toBe('PROV');
    expect(normalized.entries[0].title).toBe('Irritable Bowel Syndrome (IBS)');
    expect(normalized.entries[0].summaryText).toContain('Summary text.');
    expect(normalized.entries[0].summaryText).not.toContain('Etiology');
    expect(normalized.entries[0].subLinks[0].label).toBe('Full Summary');
    expect(normalized.entries[0].subLinks[1].label).toBe('Etiology');
    expect(normalized.entries[0].subLinks.filter((link) => link.label === 'Etiology')).toHaveLength(
      1
    );
    expect(normalized.entries[0].primaryUrl).toContain('media=hybrid');
    expect(normalized.entries[0].primaryUrl).not.toContain('content=summary');
    expect(normalized.entries[0].subLinks[1].url).not.toContain('content=summary');
    expect(normalized.entries[0].subLinks[1].url).toContain('#x');
  });

  it('accepts Merck/MSD manual and vet-manual domains', () => {
    expect(isAllowedMerckUrl('https://www.msdvetmanual.com/x')).toBe(true);
    expect(isAllowedMerckUrl('https://www.merckvetmanual.com/x')).toBe(true);
    expect(isAllowedMerckUrl('https://www.msdmanuals.com/x')).toBe(true);
    expect(isAllowedMerckUrl('https://www.merckmanuals.com/x')).toBe(true);
    expect(isAllowedMerckUrl('https://example.com/x')).toBe(false);
  });
});
