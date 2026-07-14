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
  );

export const isCustomSoap = (note: SoapNoteEntry) => Boolean(note.customSchema?.length);
