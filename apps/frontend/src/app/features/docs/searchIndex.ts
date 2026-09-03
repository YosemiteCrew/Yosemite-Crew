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

/*
 * Fences are stripped by a LINE SCAN, not a regex.
 *
 * `/^```[\s\S]*?^```/gm` and `/\[([^\]]*)\]\([^)]*\)/g` both backtrack
 * superlinearly on unbalanced input - an unclosed fence, or a run of `[`. The
 * corpus is contributor-editable, so that is a denial-of-service vector on the
 * build, not a hypothetical. A single pass over the lines is linear and easier
 * to read besides.
 */
const FENCE_MARKERS = ['```', '~~~'];

const stripFences = (markdown: string): string => {
  const kept: string[] = [];
  let openMarker: string | null = null;

  for (const line of markdown.split('\n')) {
    const trimmed = line.trimStart();
    const marker = FENCE_MARKERS.find((candidate) => trimmed.startsWith(candidate));

    if (openMarker) {
      // Only the marker that opened the fence can close it.
      if (marker === openMarker) openMarker = null;
      continue;
    }
    if (marker) {
      openMarker = marker;
      continue;
    }
    kept.push(line);
  }

  return kept.join('\n');
};

/** Unwraps `[text](target)` to `text` in one pass, with no backtracking. */
const stripLinkTargets = (text: string): string => {
  let out = '';
  let index = 0;

  while (index < text.length) {
    const open = text.indexOf('[', index);
    if (open === -1) {
      out += text.slice(index);
      break;
    }
    const close = text.indexOf(']', open + 1);
    if (close === -1 || text[close + 1] !== '(') {
      out += text.slice(index, open + 1);
      index = open + 1;
      continue;
    }
    const target = text.indexOf(')', close + 2);
    if (target === -1) {
      out += text.slice(index, open + 1);
      index = open + 1;
      continue;
    }
    out += text.slice(index, open) + text.slice(open + 1, close);
    index = target + 1;
  }

  return out;
};

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
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
  stripLinkTargets(stripFences(markdown).replace(HTML_COMMENT, ' '))
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
