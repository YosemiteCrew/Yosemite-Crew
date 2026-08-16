/**
 * Content model for the long-form legal documents (terms, privacy policy).
 *
 * The text of these documents is a contract, so it lives as data rather than as
 * JSX: a legal update is then a reviewable content diff, and the rendering rules
 * stay in one small component. Mirrors the shape used by the mobile reader in
 * `apps/mobileAppYC/src/features/legal/data/legalContentTypes.ts`, extended with
 * the headings, tables and links the web documents need.
 *
 * Every item carries `k`, a key that is unique among its siblings, so the
 * renderer never keys a list by array index.
 */

/** One run of inline content: plain text, emphasis, a link, or a line break. */
export type LegalInline =
  | string
  | { k: string; text: string; bold: true }
  | { k: string; text: string; href: string }
  | { k: string; br: true };

/**
 * Content of a block or cell. Most of this document is unformatted prose, so the
 * common case is written as a bare string and only mixed content needs the array
 * form. That keeps a table row to one readable line per cell.
 */
export type LegalContent = string | LegalInline[];

/** A table cell. `header` cells render as a row header. */
export interface LegalCell {
  k: string;
  content: LegalContent;
  header?: true;
}

export interface LegalRow {
  k: string;
  cells: LegalCell[];
}

/** One list item, itself a run of blocks so that lists can nest. */
export interface LegalListItem {
  k: string;
  blocks: LegalBlock[];
}

export type LegalBlock =
  | { k: string; type: 'p' | 'h3' | 'h4' | 'h5'; content: LegalContent }
  /** A bare inline run, used for the text of a list item. */
  | { k: string; type: 'text'; content: LegalContent }
  | { k: string; type: 'ul' | 'ol'; items: LegalListItem[] }
  | {
      k: string;
      type: 'table';
      /** Visually hidden caption, announced to screen readers. */
      caption?: string;
      /** Visually hidden column headers for a table whose header row is implied. */
      head?: string[];
      rows: LegalRow[];
    };

export interface LegalSection {
  id: string;
  title: string;
  blocks: LegalBlock[];
}
