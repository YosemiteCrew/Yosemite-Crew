import type { TemplateKind, TemplateLike } from '@yosemite-crew/types';
import { getData } from '@/app/services/axios';

// Shared between the forms module (templateFormsService) and the appointment workspace
// (workspaceTemplateService), which list the same PMS template endpoints.
export type TemplateListParams = {
  kind?: TemplateKind;
  status?: string;
  scope?: string;
};

export const listTemplates = async (url: string, params: TemplateListParams = {}) => {
  const res = await getData<TemplateLike[]>(url, params);
  return Array.isArray(res.data) ? res.data : [];
};

export const dedupeTemplates = (templates: TemplateLike[]) => {
  const byId = new Map<string, TemplateLike>();
  for (const template of templates) {
    if (template?.id) {
      byId.set(template.id, template);
    }
  }
  return [...byId.values()];
};
