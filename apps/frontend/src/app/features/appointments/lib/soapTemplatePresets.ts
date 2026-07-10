import type { SoapTemplateOption } from '@/app/features/appointments/pages/AppointmentWorkspace/components/SoapTemplateChip';
import type { SoapTemplate } from '@/app/features/appointments/types/workspace';

/** Rich-text section content a preset pre-fills into the S/O/A/P editors. */
export type SoapPresetContent = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export type SoapTemplatePreset = SoapTemplateOption & {
  content: SoapPresetContent;
};

const p = (text: string): string => `<p>${text}</p>`;

/**
 * Built-in clinical SOAP note presets used by the template chip when the org has no
 * saved SOAP templates. These are generic clinical prompts (not patient data): a real,
 * self-contained selector that pre-fills the S/O/A/P sections on select. They carry no
 * backend template id, so applying one only seeds the editor text.
 */
export const BUILTIN_SOAP_TEMPLATES: SoapTemplatePreset[] = [
  {
    id: 'builtin-wellness',
    name: 'Wellness',
    subtitle: 'Built-in · 4 sections',
    content: {
      subjective: p(
        'Presented for a routine annual wellness examination. No owner concerns reported.'
      ),
      objective: p(
        'Bright, alert and responsive. TPR within normal limits; physical examination unremarkable.'
      ),
      assessment: p('Healthy patient. Preventive care up to date.'),
      plan: p(
        'Continue routine preventive care. Update vaccinations and parasite prevention as due.'
      ),
    },
  },
  {
    id: 'builtin-sick-visit',
    name: 'Sick visit',
    subtitle: 'Built-in · 4 sections',
    content: {
      subjective: p(
        'Presented for evaluation of new clinical signs. History of present illness recorded.'
      ),
      objective: p('Examination findings and relevant vitals recorded.'),
      assessment: p('Differential diagnoses under consideration.'),
      plan: p('Initiate diagnostics and symptomatic treatment; recheck as needed.'),
    },
  },
  {
    id: 'builtin-recheck',
    name: 'Recheck',
    subtitle: 'Built-in · 4 sections',
    content: {
      subjective: p(
        'Recheck of a previously identified problem. Owner reports response to treatment.'
      ),
      objective: p('Interval examination findings recorded.'),
      assessment: p('Response to therapy assessed.'),
      plan: p('Adjust therapy as indicated and schedule the next follow-up.'),
    },
  },
  {
    id: 'builtin-dental',
    name: 'Dental',
    subtitle: 'Built-in · 4 sections',
    content: {
      subjective: p('Presented for dental evaluation. Owner reports oral signs.'),
      objective: p('Oral examination and dental charting performed.'),
      assessment: p('Dental disease graded.'),
      plan: p('Recommend dental prophylaxis and home dental care.'),
    },
  },
];

const isPreset = (id: string): boolean => id.startsWith('builtin-');

export const findSoapPreset = (id: string): SoapTemplatePreset | undefined =>
  BUILTIN_SOAP_TEMPLATES.find((preset) => preset.id === id);

/** Short "N sections" style subtitle for a real SOAP template chip row. */
const soapTemplateSubtitle = (template: SoapTemplate): string | undefined => {
  if (template.isDefault) return 'Clinic default';
  return undefined;
};

/**
 * Build the template-chip option list. Prefers the org's real SOAP templates; falls
 * back to the built-in clinical presets when the org has none, so the chip is always a
 * working selector. `isBuiltin` tells the caller which apply path to use.
 */
export const buildSoapTemplateOptions = (
  templates: SoapTemplate[]
): { options: SoapTemplateOption[]; isBuiltin: boolean } => {
  if (templates.length > 0) {
    return {
      options: templates.map((template) => ({
        id: template.id,
        name: template.name,
        subtitle: soapTemplateSubtitle(template),
      })),
      isBuiltin: false,
    };
  }
  return {
    options: BUILTIN_SOAP_TEMPLATES.map(({ id, name, subtitle }) => ({ id, name, subtitle })),
    isBuiltin: true,
  };
};

export const isSoapPresetId = isPreset;
