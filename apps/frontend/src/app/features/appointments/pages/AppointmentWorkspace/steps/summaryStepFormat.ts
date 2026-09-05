/**
 * Formatting and download helpers shared by the summary step and its documents table.
 *
 * Split out of SummaryStep.tsx because a module that exports both React components
 * and plain values loses per-component Fast Refresh: an edit here would invalidate
 * the whole step module instead of hot-swapping one component
 * (react-doctor/only-export-components).
 */
import { formatStampDate, formatStampTime } from '@/app/lib/appointmentWorkspace';

export const formatDateTime = (iso: string): string => {
  const date = formatStampDate(iso);
  const time = formatStampTime(iso);
  return [date, time].filter(Boolean).join(', ');
};

/** Humanise a backend enum token (e.g. "DISCHARGE_SUMMARY" → "Discharge summary",
 *  "NOT_REQUIRED" → "Not required") so raw enums never reach the table. */
export const humanizeToken = (value?: string | null): string => {
  if (!value) return '-';
  const words = value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean);
  if (words.length === 0) return '-';
  return words
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
};

export const downloadDocumentUrl = (url: string) => {
  const link = globalThis.document.createElement('a');
  link.href = url;
  link.download = '';
  link.rel = 'noopener noreferrer';
  globalThis.document.body.append(link);
  link.click();
  link.remove();
};
