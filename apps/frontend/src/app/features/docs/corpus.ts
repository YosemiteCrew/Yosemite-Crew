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
 * Resolve `segments` under `base` and refuse anything that escapes it.
 *
 * The escape test uses path.relative rather than a string prefix: a target
 * inside `base` yields a relative path that is neither absolute nor starts with
 * `..`. That is the barrier form static analysis recognises, so every fs read
 * below flows its path through here before the read - the input is not
 * attacker-controlled today, but a future caller passing a path in must fail
 * the build rather than disclose a file.
 */
export const containedPath = (base: string, ...segments: string[]): string => {
  const target = path.resolve(base, ...segments);
  const relative = path.relative(base, target);
  if (relative !== '' && (relative.startsWith('..') || path.isAbsolute(relative))) {
    throw new Error(`Refusing a path outside the docs content root: "${segments.join('/')}".`);
  }
  return target;
};

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

/**
 * Every markdown file under `dir`, as paths relative to it.
 *
 * Symlinks are skipped rather than followed, and this is where that has to
 * happen. The containment check in `loadCorpus` uses `path.resolve`, which is
 * purely lexical: a link at `content/docs/x.md` pointing at `../../../.env`
 * resolves INSIDE the content root and sails through it. Here the entry is
 * still known to be a link, so it can be refused.
 *
 * That matters because this repository accepts documentation pull requests. A
 * contributed symlink is the cheapest way to turn a docs page into a file
 * disclosure, and it would look like an ordinary .md in the diff.
 */
export const listMarkdownFiles = (dir: string, base = '', root = dir): string[] => {
  const out: string[] = [];
  // Assert the directory is still inside the root walk began at before reading
  // it. On the first call dir === root; recursion only descends into real
  // dirents (symlinks are refused just below), so this can only fail if a
  // caller passes a directory that escapes the root.
  const safeDir = containedPath(root, path.relative(root, dir));
  for (const item of fs.readdirSync(safeDir, { withFileTypes: true })) {
    if (item.isSymbolicLink()) {
      continue;
    }
    const rel = base ? `${base}/${item.name}` : item.name;
    if (item.isDirectory()) {
      out.push(...listMarkdownFiles(path.join(safeDir, item.name), rel, root));
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

  const entries = listMarkdownFiles(DOCS_CONTENT_ROOT)
    .sort((a, b) => a.localeCompare(b))
    .map((file) => {
      /*
       * Containment barrier before the read. `file` comes from
       * listMarkdownFiles(), which only enumerates DOCS_CONTENT_ROOT, so it is
       * not attacker-controlled today - but a resolved path that escapes the
       * content root would mean something went wrong upstream (a future caller
       * passing a path in), and reading it would be a file-disclosure bug.
       *
       * Note this does NOT catch a symlink: path.resolve is lexical, so a link
       * inside the root resolves inside the root whatever it points at. Links
       * are refused in listMarkdownFiles, before they reach here.
       */
      const absolute = containedPath(DOCS_CONTENT_ROOT, file);
      const raw = fs.readFileSync(absolute, 'utf8');
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
