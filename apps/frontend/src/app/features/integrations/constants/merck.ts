export const MERCK_COPYRIGHT_NOTICE =
  'Copyright \u00a9 2021 Merck & Co., Inc., known as MSD outside of the US, Kenilworth, New Jersey, USA. All rights reserved.';

const MERCK_SUBTOPIC_STYLES = {
  fullSummary: { backgroundColor: '#247AED', color: '#EAF3FF', borderColor: '#247AED' },
  etiology: { backgroundColor: '#747283', color: '#F7F7F7', borderColor: '#747283' },
  symptomsAndSigns: { backgroundColor: '#BF9FAA', color: '#F7F7F7', borderColor: '#BF9FAA' },
  diagnosis: { backgroundColor: '#D9A488', color: '#F7F7F7', borderColor: '#D9A488' },
  treatment: { backgroundColor: '#5C614B', color: '#F7F7F7', borderColor: '#5C614B' },
} as const;

export const getMerckSubtopicPillStyle = (label: string) => {
  const normalized = label.trim().toLowerCase();
  if (normalized.includes('full summary')) return MERCK_SUBTOPIC_STYLES.fullSummary;
  if (normalized.includes('etiology')) return MERCK_SUBTOPIC_STYLES.etiology;
  if (normalized.includes('symptoms and signs')) return MERCK_SUBTOPIC_STYLES.symptomsAndSigns;
  if (normalized.includes('diagnosis')) return MERCK_SUBTOPIC_STYLES.diagnosis;
  if (normalized.includes('treatment')) return MERCK_SUBTOPIC_STYLES.treatment;
  return undefined;
};
