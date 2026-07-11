import {Share} from 'react-native';
import type {
  LegalContentBlock,
  LegalDocumentMeta,
  LegalSection,
} from '../data/legalContentTypes';

const blockToPlainText = (block: LegalContentBlock): string => {
  if (block.type === 'paragraph') {
    return block.segments
      .map(segment => segment.text)
      .join('')
      .trim();
  }
  return block.items
    .map(item =>
      `${item.marker} ${item.segments.map(segment => segment.text).join('')}`.trim(),
    )
    .join('\n');
};

/**
 * Flattens the real legal sections into a plain-text document. Used for the
 * "Download as PDF" affordance — the OS share sheet lets the user Print /
 * Save as PDF / Save to Files from this content.
 */
export const buildLegalPlainText = (
  title: string,
  sections: LegalSection[],
  meta?: Pick<LegalDocumentMeta, 'lastUpdated' | 'version'>,
): string => {
  const safeSections = Array.isArray(sections) ? sections : [];
  const heading = meta
    ? `${title}\nLast updated ${meta.lastUpdated} · ${meta.version}`
    : title;
  const body = safeSections
    .flatMap(section => {
      const sectionTitle = section.title ? `${section.title}\n` : '';
      const content = Array.isArray(section.blocks)
        ? section.blocks
            .flatMap(block => {
              const text = blockToPlainText(block);
              return text ? [text] : [];
            })
            .join('\n')
        : '';
      const line = `${sectionTitle}${content}`.trim();
      return line ? [line] : [];
    })
    .join('\n\n');
  return `${heading}\n\n${body}\n`;
};

/**
 * Opens the OS share sheet with the legal document so the user can export it
 * (Save as PDF / Print / Save to Files). Uses React Native's built-in Share —
 * no extra native dependency. Silently ignores a user-dismissed sheet.
 */
export const exportLegalDocument = async (
  title: string,
  sections: LegalSection[],
  meta?: Pick<LegalDocumentMeta, 'lastUpdated' | 'version'>,
): Promise<void> => {
  const message = buildLegalPlainText(title, sections, meta);
  try {
    await Share.share({title, message}, {subject: title});
  } catch {
    // User dismissed the share sheet — not an error.
  }
};
