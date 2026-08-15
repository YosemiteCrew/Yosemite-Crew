import type { TemplateLike, TemplateSchemaSnapshot } from '@yosemite-crew/types';

export const hasTemplateSchemaSnapshot = (value: unknown): value is TemplateSchemaSnapshot =>
  Boolean(
    value && typeof value === 'object' && Array.isArray((value as { sections?: unknown }).sections)
  );

/**
 * Resolve a template's schema snapshot: prefer the root-level snapshot, then
 * fall back to the published (or latest) version's snapshot.
 */
export const getTemplateSchemaSnapshot = (
  template: TemplateLike
): TemplateSchemaSnapshot | undefined => {
  const rootSnapshot = (template as TemplateLike & { schemaSnapshot?: unknown }).schemaSnapshot;
  if (hasTemplateSchemaSnapshot(rootSnapshot)) return rootSnapshot;
  const version = template.versions?.find(
    (item) => item.version === template.publishedVersion || item.version === template.latestVersion
  );
  return hasTemplateSchemaSnapshot(version?.schemaSnapshot) ? version.schemaSnapshot : undefined;
};
