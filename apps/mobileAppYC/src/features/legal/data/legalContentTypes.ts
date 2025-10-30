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
