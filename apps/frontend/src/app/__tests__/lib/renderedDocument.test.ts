import { buildRenderedDocumentDraft } from '@yosemite-crew/types';

const baseInput = {
  title: 'Visit summary',
  source: {
    sourceKind: 'TEMPLATE_INSTANCE' as const,
    sourceId: 'source-123',
    organisationId: 'org-456',
    templateKind: 'FORM' as const,
  },
};

describe('buildRenderedDocumentDraft', () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  });

  it('uses crypto.randomUUID when available', () => {
    const randomUUID = jest.fn(() => 'uuid-123');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID },
    });

    const document = buildRenderedDocumentDraft(baseInput);

    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(document.id).toBe('uuid-123');
    expect(document.signable).toBe(true);
    expect(document.source.organisationId).toBe('org-456');
  });

  it('falls back to a generated id when crypto.randomUUID is unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined,
    });

    const document = buildRenderedDocumentDraft(baseInput);

    expect(document.id).toMatch(/^rendered-document-/);
    expect(document.kind).toBe('FORM');
    expect(document.status).toBe('DRAFT');
  });
});
