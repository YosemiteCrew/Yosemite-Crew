import path from 'node:path';
import { DOCS_BASE_PATH, type DocEntry } from './corpus';

/**
 * Rewrites the link forms the corpus actually uses into `/docs/...` URLs.
 *
 * Three forms exist today, and all three are supported rather than banned:
 *
 *   1. Site-absolute, `/apps/backend/api` - what Docusaurus slugs produced.
 *   2. Relative to the source file, `./availability.md` or `../index.md` - the
 *      universal markdown convention, and what a contributor writing a docs PR
 *      will reach for. Resolving these is about ten lines, and refusing them
 *      would turn a working link into a build failure for an outside
 *      contributor.
 *   3. Bare anchors, `#section`, which are left alone.
 *
 * External links (scheme-qualified, protocol-relative, or mailto) pass through
 * untouched.
 */

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

export interface LinkResolution {
  href: string;
  /** True when the link pointed at a markdown file that does not exist. */
  broken: boolean;
}

const splitHash = (href: string): [string, string] => {
  const hashIndex = href.indexOf('#');
  if (hashIndex === -1) return [href, ''];
  return [href.slice(0, hashIndex), href.slice(hashIndex)];
};

/**
 * @param href     the raw link as written in the markdown
 * @param fromFile the corpus-relative file the link appears in
 * @param corpus   every known page, used to resolve a target file to its slug
 */
export const resolveDocLink = (
  href: string,
  fromFile: string,
  corpus: DocEntry[]
): LinkResolution => {
  if (!href || EXTERNAL.test(href) || href.startsWith('#')) {
    return { href, broken: false };
  }

  const [target, hash] = splitHash(href);

  if (target === '') {
    return { href, broken: false };
  }

  // Relative to the file it is written in.
  if (target.startsWith('./') || target.startsWith('../')) {
    const resolved = path.normalize(path.join(path.dirname(fromFile), target)).replace(/^\.\//, '');
    const entry = corpus.find(
      (candidate) =>
        candidate.file === resolved ||
        candidate.file === `${resolved}.md` ||
        candidate.file === `${resolved}/index.md`
    );
    if (!entry) return { href, broken: true };
    return { href: `${entry.href}${hash}`, broken: false };
  }

  // Site-absolute: either already a slug, or a slug with a .md suffix.
  if (target.startsWith('/')) {
    const withoutExtension = target.replace(/\.mdx?$/, '');
    const entry = corpus.find((candidate) => candidate.slug === withoutExtension);
    if (entry) return { href: `${entry.href}${hash}`, broken: false };
    // A site-absolute link to something outside the corpus is an app route, not
    // a docs page - leave it be.
    return { href, broken: false };
  }

  // Bare relative, `availability.md`, resolved against the same directory.
  const resolved = path.normalize(path.join(path.dirname(fromFile), target)).replace(/^\.\//, '');
  const entry = corpus.find(
    (candidate) =>
      candidate.file === resolved ||
      candidate.file === `${resolved}.md` ||
      candidate.file === `${resolved}/index.md`
  );
  if (!entry) return { href, broken: true };
  return { href: `${entry.href}${hash}`, broken: false };
};

export const isDocsHref = (href: string): boolean =>
  href === DOCS_BASE_PATH || href.startsWith(`${DOCS_BASE_PATH}/`);
