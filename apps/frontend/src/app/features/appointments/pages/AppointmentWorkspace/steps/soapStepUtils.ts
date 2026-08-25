import { SOAP_CODED_SECTIONS } from '@yosemite-crew/types';
import type { SoapNoteEntry } from '@/app/features/appointments/types/workspace';
import { isRichTextEmpty } from '@/app/lib/richText';

export const EMPTY_SOAP: SoapNoteEntry = {
  id: 'draft',
  chiefComplaint: '',
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
  status: 'EMPTY',
  createdAt: '',
};

export const isPersistedSoapId = (value?: string) =>
  Boolean(value && value !== 'draft' && !value.startsWith('local-'));

export const hasNativeSoapContent = (note: SoapNoteEntry) =>
  [note.chiefComplaint, note.subjective, note.objective, note.assessment, note.plan].some(
    (value) => !isRichTextEmpty(value)
  ) ||
  // Coded terms alone are real clinical content: a note that only pins vocabulary
  // codes must still persist rather than silently advancing without a save.
  SOAP_CODED_SECTIONS.some((section) => (note.codedProblems?.[section]?.length ?? 0) > 0);

export const isCustomSoap = (note: SoapNoteEntry) => Boolean(note.customSchema?.length);
