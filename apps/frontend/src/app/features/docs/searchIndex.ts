import { loadCorpus, type DocEntry } from './corpus';

/**
 * Builds the client-side search index.
 *
 * WHAT IS EXCLUDED, AND WHY IT IS NARROWER THAN IT LOOKS
 *
 * Fenced code blocks are stripped, because one of the guides carries a Stream
 * API key in a ```ts fence and a search index is a browser artifact - anything
 * in it is public regardless of what the page renders.
 *
 * INLINE code spans are deliberately KEPT. Stripping them too would be the easy
 * over-correction and it would gut the corpus: the 36 router reference pages
 * are almost entirely inline code, so removing those spans would make
 * `requireWebAuth` or `UserController.getById` unfindable - which is precisely
 * what someone searching these pages is looking for. The secret lives in a
 * fence, so fences alone carry the security property.
 */

export interface SearchDoc {
  title: string;
  href: string;
  section: string;
  text: string;
}

const FENCE = /^```[\s\S]*?^```/gm;
const INDENTED_FENCE = /^~~~[\s\S]*?^~~~/gm;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const MD_LINK = /\[([^\]]*)\]\([^)]*\)/g;
const HEADING_MARK = /^#{1,6}\s+/gm;
const INLINE_CODE_TICKS = /`([^`]*)`/g;

const SECTION_BY_PREFIX: Array<[string, string]> = [
  ['apps/backend/routers/', 'Backend API'],
  ['apps/backend', 'Apps'],
  ['apps/', 'Apps'],
  ['guides/', 'Guides'],
  ['ui-system/', 'UI System'],
  ['policies/', 'Policies'],
];

const sectionFor = (file: string): string => {
  for (const [prefix, label] of SECTION_BY_PREFIX) {
    if (file.startsWith(prefix)) return label;
  }
  return 'Overview';
};

export const toSearchText = (markdown: string): string =>
  markdown
    .replace(FENCE, ' ')
    .replace(INDENTED_FENCE, ' ')
    .replace(HTML_COMMENT, ' ')
    // Keep the link text, drop the target.
    .replace(MD_LINK, '$1')
    .replace(HEADING_MARK, '')
    // Unwrap inline code to its literal content - see the header.
    .replace(INLINE_CODE_TICKS, '$1')
    .replaceAll(/[*_>|#]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();

export const buildSearchIndex = (corpus: DocEntry[] = loadCorpus()): SearchDoc[] =>
  corpus.map((entry) => ({
    title: entry.title,
    href: entry.href,
    section: sectionFor(entry.file),
    text: toSearchText(entry.body).slice(0, 4000),
  }));
