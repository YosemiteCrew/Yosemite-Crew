import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

/**
 * Reads the developer documentation corpus off disk.
 *
 * The 52 markdown files under content/docs are the source of truth. Nothing is
 * generated at request time - every page is prerendered - so this runs at build
 * time only.
 */

export const DOCS_CONTENT_ROOT = path.join(process.cwd(), 'content', 'docs');

/** Every docs URL lives under this prefix. */
export const DOCS_BASE_PATH = '/docs';

export interface DocEntry {
  /** Path relative to the content root, e.g. `apps/backend/routers/user.md`. */
  file: string;
  /** Frontmatter id where present, otherwise derived from the file path. */
  id: string;
  title: string;
  description?: string;
  sidebarPosition?: number;
  /**
   * Corpus slug, always leading-slash and never trailing-slash: `/apps/backend`.
   * The root page carries `/`, which becomes the `/docs` index.
   */
  slug: string;
  /** Route params for this page. The root page is the empty array. */
  segments: string[];
  /** Public URL, e.g. `/docs/apps/backend`. */
  href: string;
  /** Markdown body with frontmatter stripped. */
  body: string;
}

const stripExtension = (file: string) => file.replace(/\.mdx?$/, '');

/**
 * Five files under ui-system/ carry no `slug`, so the path supplies one -
 * matching what Docusaurus did by default.
 */
const deriveSlug = (file: string) => {
  const withoutExtension = stripExtension(file);
  const normalised = withoutExtension.replace(/\/index$/, '');
  return `/${normalised}`;
};

const normaliseSlug = (raw: string) => {
  const trimmed = raw.trim();
  if (trimmed === '/' || trimmed === '') return '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading;
};

export const slugToSegments = (slug: string): string[] =>
  slug === '/' ? [] : slug.replace(/^\//, '').split('/');

export const slugToHref = (slug: string): string =>
  slug === '/' ? DOCS_BASE_PATH : `${DOCS_BASE_PATH}${slug}`;

const walk = (dir: string, base = ''): string[] => {
  const out: string[] = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${item.name}` : item.name;
    if (item.isDirectory()) {
      out.push(...walk(path.join(dir, item.name), rel));
    } else if (/\.mdx?$/.test(item.name)) {
      out.push(rel);
    }
  }
  return out;
};

/*
 * Module-scope memo, deliberately not React `cache()`. React's cache is scoped
 * to a render context; generateStaticParams runs outside one and each page
 * prerender is its own pass, so `cache()` would re-read and re-parse the whole
 * corpus dozens of times per build. A plain module-level value persists for the
 * life of the build process, which is what is actually wanted here.
 */
let memo: DocEntry[] | null = null;

export const loadCorpus = (): DocEntry[] => {
  if (memo) return memo;

  const entries = walk(DOCS_CONTENT_ROOT)
    .sort((a, b) => a.localeCompare(b))
    .map((file) => {
      const raw = fs.readFileSync(path.join(DOCS_CONTENT_ROOT, file), 'utf8');
      const { data, content } = matter(raw);

      const slug = normaliseSlug(typeof data.slug === 'string' ? data.slug : deriveSlug(file));

      return {
        file,
        id: typeof data.id === 'string' ? data.id : stripExtension(file),
        title: typeof data.title === 'string' ? data.title : stripExtension(file),
        description: typeof data.description === 'string' ? data.description : undefined,
        sidebarPosition:
          typeof data.sidebar_position === 'number' ? data.sidebar_position : undefined,
        slug,
        segments: slugToSegments(slug),
        href: slugToHref(slug),
        body: content,
      } satisfies DocEntry;
    });

  const bySlug = new Map<string, string>();
  for (const entry of entries) {
    const clash = bySlug.get(entry.slug);
    if (clash) {
      throw new Error(
        `Duplicate docs slug "${entry.slug}" in ${entry.file} and ${clash}. ` +
          'Two pages cannot answer the same URL.'
      );
    }
    bySlug.set(entry.slug, entry.file);
  }

  memo = entries;
  return entries;
};

export const findBySlug = (slug: string): DocEntry | undefined =>
  loadCorpus().find((entry) => entry.slug === normaliseSlug(slug));

export const findBySegments = (segments: string[] = []): DocEntry | undefined =>
  findBySlug(segments.length ? `/${segments.join('/')}` : '/');
