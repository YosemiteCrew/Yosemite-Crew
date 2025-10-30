import type {
  TextSegment,
  ParagraphBlock,
  OrderedListItem,
  OrderedListBlock,
} from './legalContentTypes';

// Reusable constructors for legal content data files.
export const seg = (text: string, opts?: Partial<TextSegment>): TextSegment => ({text, ...(opts as any)});
export const b = (text: string) => seg(text, {bold: true});
export const u = (text: string) => seg(text, {underline: true});
export const p = (...segments: Array<string | TextSegment>): ParagraphBlock => ({
  type: 'paragraph',
  segments: segments.map(s => (typeof s === 'string' ? seg(s) : s)),
});
export const oli = (marker: string, ...segments: Array<string | TextSegment>): OrderedListItem => ({
  marker,
  markerBold: true,
  segments: segments.map(s => (typeof s === 'string' ? seg(s) : s)),
});
export const ol = (...items: OrderedListItem[]): OrderedListBlock => ({type: 'ordered-list', items});
