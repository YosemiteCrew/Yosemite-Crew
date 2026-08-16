import {
  getTemplateSchemaSnapshot,
  hasTemplateSchemaSnapshot,
} from '@/app/features/appointments/pages/AppointmentWorkspace/templateSchemaSnapshot';
import type { TemplateLike } from '@yosemite-crew/types';

const asTemplate = (value: Record<string, unknown>): TemplateLike =>
  value as unknown as TemplateLike;

describe('hasTemplateSchemaSnapshot', () => {
  it('accepts an object with a sections array', () => {
    expect(hasTemplateSchemaSnapshot({ sections: [] })).toBe(true);
  });

  it('rejects nullish, primitive and sections-less values', () => {
    expect(hasTemplateSchemaSnapshot(null)).toBe(false);
    expect(hasTemplateSchemaSnapshot(undefined)).toBe(false);
    expect(hasTemplateSchemaSnapshot('sections')).toBe(false);
    expect(hasTemplateSchemaSnapshot({})).toBe(false);
    expect(hasTemplateSchemaSnapshot({ sections: {} })).toBe(false);
  });
});

describe('getTemplateSchemaSnapshot', () => {
  const snapshot = { sections: [{ fields: [] }] };

  it('returns the root-level snapshot when present', () => {
    const template = asTemplate({ schemaSnapshot: snapshot, versions: [] });
    expect(getTemplateSchemaSnapshot(template)).toBe(snapshot);
  });

  it('falls back to the published version snapshot', () => {
    const template = asTemplate({
      publishedVersion: 2,
      versions: [
        { version: 1, schemaSnapshot: { sections: [] } },
        { version: 2, schemaSnapshot: snapshot },
      ],
    });
    expect(getTemplateSchemaSnapshot(template)).toBe(snapshot);
  });

  it('falls back to the latest version snapshot when nothing is published', () => {
    const template = asTemplate({
      latestVersion: 3,
      versions: [{ version: 3, schemaSnapshot: snapshot }],
    });
    expect(getTemplateSchemaSnapshot(template)).toBe(snapshot);
  });

  it('returns undefined when the matched version has no valid snapshot', () => {
    const template = asTemplate({
      publishedVersion: 1,
      versions: [{ version: 1, schemaSnapshot: { sections: 'nope' } }],
    });
    expect(getTemplateSchemaSnapshot(template)).toBeUndefined();
  });

  it('returns undefined when no version matches or versions are missing', () => {
    expect(
      getTemplateSchemaSnapshot(
        asTemplate({ publishedVersion: 9, versions: [{ version: 1, schemaSnapshot: snapshot }] })
      )
    ).toBeUndefined();
    expect(getTemplateSchemaSnapshot(asTemplate({}))).toBeUndefined();
  });
});
