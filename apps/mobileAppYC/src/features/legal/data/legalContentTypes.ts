export interface TextSegment {
  text: string;
  bold?: boolean;
  underline?: boolean;
}

export interface ParagraphBlock {
  type: 'paragraph';
  segments: TextSegment[];
}

export interface OrderedListItem {
  marker: string;
  markerBold?: boolean;
  segments: TextSegment[];
}

export interface OrderedListBlock {
  type: 'ordered-list';
  items: OrderedListItem[];
}

export type LegalContentBlock = ParagraphBlock | OrderedListBlock;

export interface LegalSection {
  id: string;
  title: string;
  blocks: LegalContentBlock[];
  // optional alignment: 'center' currently supported
  align?: 'center' | 'left';
}

/**
 * Metadata for the legal reader header (serif display title + the "last
 * updated" pill). Kept separate from the section content so the real legal
 * text stays untouched.
 */
export interface LegalDocumentMeta {
  /** Serif display title shown under the header, e.g. "Terms of service". */
  displayTitle: string;
  /** Human-readable effective date, e.g. "28 Jun 2026". */
  lastUpdated: string;
  /** Short version/label shown after the date, e.g. "v1.0" or "GDPR". */
  version: string;
}
