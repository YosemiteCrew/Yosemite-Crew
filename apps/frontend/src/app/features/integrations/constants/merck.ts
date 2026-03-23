// Allowed inline HTML tags from the Merck API (e.g. <i>Rhodococcus equi</i>).
// Only these tags are kept; all others are stripped to plain text.
const ALLOWED_INLINE_TAGS = new Set(['i', 'em', 'b', 'strong', 'sup', 'sub']);
const HTML_TAG_NAME_PATTERN = /^\/?\s*([a-zA-Z][a-zA-Z0-9]*)\b/;

export const sanitizeMerckHtml = (raw: string): string => {
  // Walk tags manually to avoid catastrophic backtracking on malformed HTML-like input.
  let sanitized = '';
  let cursor = 0;

  while (cursor < raw.length) {
    const openingBracket = raw.indexOf('<', cursor);
    if (openingBracket === -1) {
      sanitized += raw.slice(cursor);
      break;
    }

    const closingBracket = raw.indexOf('>', openingBracket + 1);
    if (closingBracket === -1) {
      sanitized += raw.slice(cursor);
      break;
    }

    sanitized += raw.slice(cursor, openingBracket);

    const tagContent = raw.slice(openingBracket + 1, closingBracket);
    const tagMatch = HTML_TAG_NAME_PATTERN.exec(tagContent);
    const tagName = tagMatch?.[1]?.toLowerCase() ?? '';
    if (ALLOWED_INLINE_TAGS.has(tagName)) {
      sanitized += raw.slice(openingBracket, closingBracket + 1);
    }

    cursor = closingBracket + 1;
  }

  return sanitized;
};

export const MERCK_COPYRIGHT_NOTICE =
  'Copyright \u00a9 2021 Merck & Co., Inc., known as MSD outside of the US, Kenilworth, New Jersey, USA. All rights reserved.';

const MERCK_SUBTOPIC_STYLES = {
  fullSummary: { backgroundColor: '#247AED', color: '#EAF3FF', borderColor: '#247AED' },
  etiology: { backgroundColor: '#747283', color: '#F7F7F7', borderColor: '#747283' },
  symptomsAndSigns: { backgroundColor: '#BF9FAA', color: '#F7F7F7', borderColor: '#BF9FAA' },
  diagnosis: { backgroundColor: '#D9A488', color: '#F7F7F7', borderColor: '#D9A488' },
  treatment: { backgroundColor: '#5C614B', color: '#F7F7F7', borderColor: '#5C614B' },
} as const;

const MERCK_SUBTOPIC_PALETTE = Object.values(MERCK_SUBTOPIC_STYLES);

const pickStyleFromLabel = (label: string) => {
  let hash = 0;
  for (const character of label) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }
  return MERCK_SUBTOPIC_PALETTE[hash % MERCK_SUBTOPIC_PALETTE.length];
};

export const getMerckSubtopicPillStyle = (label: string) => {
  const normalized = label.trim().toLowerCase();
  if (normalized.includes('full summary')) return MERCK_SUBTOPIC_STYLES.fullSummary;
  if (normalized.includes('etiology')) return MERCK_SUBTOPIC_STYLES.etiology;
  if (normalized.includes('symptoms and signs')) return MERCK_SUBTOPIC_STYLES.symptomsAndSigns;
  if (normalized.includes('diagnosis')) return MERCK_SUBTOPIC_STYLES.diagnosis;
  if (normalized.includes('treatment')) return MERCK_SUBTOPIC_STYLES.treatment;
  return pickStyleFromLabel(normalized || 'default');
};
