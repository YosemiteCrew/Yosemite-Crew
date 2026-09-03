import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  findBySegments,
  findBySlug,
  listMarkdownFiles,
  loadCorpus,
  slugToHref,
  slugToSegments,
} from '@/app/features/docs/corpus';
import { buildDocsNav, flattenNav } from '@/app/features/docs/docsNav';

/*
 * These assert structural invariants rather than a literal page count, so the
 * guards survive the corpus growing. A hardcoded 52 would have to be edited
 * every time a router is documented, and an assertion people routinely edit
 * stops being a guard.
 */
describe('docs corpus', () => {
  const corpus = loadCorpus();

  it('loads every markdown file', () => {
    expect(corpus.length).toBeGreaterThan(40);
  });

  it('gives every page a title, a slug and an id', () => {
    for (const entry of corpus) {
      expect(entry.title.trim()).not.toBe('');
      expect(entry.slug.startsWith('/')).toBe(true);
      expect(entry.id.trim()).not.toBe('');
    }
  });

  it('never lets two pages answer the same URL', () => {
    const slugs = corpus.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('has exactly one root page, which becomes /docs', () => {
    const roots = corpus.filter((entry) => entry.slug === '/');
    expect(roots).toHaveLength(1);
    expect(roots[0].segments).toEqual([]);
    expect(roots[0].href).toBe('/docs');
  });

  it('never emits a trailing slash in an href', () => {
    for (const entry of corpus) {
      expect(entry.href.endsWith('/')).toBe(false);
    }
  });

  it('derives a slug for the pages that declare none', () => {
    const derived = corpus.filter((entry) => entry.file.startsWith('ui-system/'));
    expect(derived.length).toBeGreaterThan(0);
    for (const entry of derived) {
      expect(entry.slug).toBe(`/${entry.file.replace(/\.md$/, '')}`);
    }
  });

  it('round-trips slug to segments and back', () => {
    for (const entry of corpus) {
      expect(slugToSegments(entry.slug)).toEqual(entry.segments);
      expect(slugToHref(entry.slug)).toBe(entry.href);
    }
  });

  it('finds a page by slug and by segments', () => {
    const target = corpus.find((entry) => entry.segments.length > 1);
    expect(target).toBeDefined();
    expect(findBySlug(target!.slug)?.file).toBe(target!.file);
    expect(findBySegments(target!.segments)?.file).toBe(target!.file);
    expect(findBySegments([])?.slug).toBe('/');
    expect(findBySegments(['nope', 'missing'])).toBeUndefined();
  });
});

describe('docs nav', () => {
  const corpus = loadCorpus();

  /*
   * A page that exists but is in no section is reachable only by guessing its
   * URL. That is how a docs site quietly loses pages, so the count is tied to
   * the corpus rather than to a literal.
   */
  it('makes every page in the corpus reachable', () => {
    const links = flattenNav(buildDocsNav(corpus));
    expect(links).toHaveLength(corpus.length);
    expect(new Set(links.map((link) => link.href)).size).toBe(corpus.length);
  });

  it('points every nav link at a real page', () => {
    const hrefs = new Set(corpus.map((entry) => entry.href));
    for (const link of flattenNav(buildDocsNav(corpus))) {
      expect(hrefs.has(link.href)).toBe(true);
    }
  });

  it('fails loudly when a page is missing from the nav', () => {
    const trimmed = corpus.filter((entry) => entry.id !== 'overview');
    expect(() => buildDocsNav(trimmed)).toThrow(/overview/);
  });

  it('fails loudly when a page exists but no section claims it', () => {
    const extra = [
      ...corpus,
      { ...corpus[0], id: 'orphan-page', file: 'orphan.md', slug: '/orphan' },
    ];
    expect(() => buildDocsNav(extra)).toThrow(/unreachable/);
  });

  it('collapses the router reference section by default', () => {
    const backendApi = buildDocsNav(corpus).find(
      (node) => node.kind === 'section' && node.label === 'Backend API'
    );
    expect(backendApi).toMatchObject({ collapsed: true });
  });
});

describe('corpus file reads stay inside the content root', () => {
  /*
   * walk() only enumerates the content root, so this is not reachable today.
   * It is asserted anyway because the failure mode - reading a file outside
   * the docs directory and rendering it to the public web - is file disclosure,
   * and the guard is two lines.
   */
  it('refuses a path that escapes the content root', async () => {
    const { DOCS_CONTENT_ROOT, containedPath } = await import('@/app/features/docs/corpus');

    // Exercise the real barrier, not a re-implementation of it: a broken
    // containedPath must fail this test.
    expect(() => containedPath(DOCS_CONTENT_ROOT, '../../../../etc/passwd')).toThrow(
      /outside the docs content root/
    );
  });

  it('returns the resolved path for a file inside the content root', async () => {
    const path = await import('node:path');
    const { DOCS_CONTENT_ROOT, containedPath } = await import('@/app/features/docs/corpus');

    expect(containedPath(DOCS_CONTENT_ROOT, 'apps/backend/api/chat.md')).toBe(
      path.resolve(DOCS_CONTENT_ROOT, 'apps/backend/api/chat.md')
    );
    // The root itself is contained.
    expect(containedPath(DOCS_CONTENT_ROOT)).toBe(DOCS_CONTENT_ROOT);
  });

  it('accepts a real corpus path', async () => {
    const path = await import('node:path');
    const { DOCS_CONTENT_ROOT, loadCorpus } = await import('@/app/features/docs/corpus');

    const resolved = path.resolve(DOCS_CONTENT_ROOT, loadCorpus()[0].file);
    expect(resolved.startsWith(DOCS_CONTENT_ROOT + path.sep)).toBe(true);
  });
});

/*
 * The corpus is built from files contributed by pull request, so the walker is
 * a security boundary and not just a file lister.
 *
 * A symlink is the cheap version of the attack: it looks like an ordinary .md
 * in a diff, and the containment check in loadCorpus cannot stop it, because
 * path.resolve is lexical and a link inside the content root resolves inside
 * the content root no matter where it points.
 */
describe('listMarkdownFiles', () => {
  let root: string;
  let secretPath: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-walk-'));
    fs.writeFileSync(path.join(root, 'real.md'), '# real');
    secretPath = path.join(root, 'secret.env');
    fs.writeFileSync(secretPath, 'API_KEY=not-a-real-value');
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('lists ordinary markdown files', () => {
    expect(listMarkdownFiles(root)).toEqual(['real.md']);
  });

  it('refuses a symlinked markdown file pointing outside the tree', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-outside-'));
    fs.writeFileSync(path.join(outside, 'stolen.md'), '# stolen');
    fs.symlinkSync(path.join(outside, 'stolen.md'), path.join(root, 'link.md'));

    expect(listMarkdownFiles(root)).toEqual(['real.md']);

    fs.rmSync(outside, { recursive: true, force: true });
  });

  /*
   * This one does NOT exercise the isSymbolicLink() guard: readdirSync with
   * withFileTypes uses lstat, so a link to a directory already reports
   * isDirectory() false and is never recursed into. What it pins is that
   * lstat semantics, which a switch to statSync would silently reverse - and
   * that switch would make symlinked directories traversable again.
   */
  it('does not follow a symlinked directory, because readdir does not stat through it', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-outdir-'));
    fs.writeFileSync(path.join(outside, 'deep.md'), '# deep');
    fs.symlinkSync(outside, path.join(root, 'linked-dir'));

    expect(listMarkdownFiles(root)).toEqual(['real.md']);

    fs.rmSync(outside, { recursive: true, force: true });
  });

  it('recurses into real subdirectories', () => {
    fs.mkdirSync(path.join(root, 'guides'));
    fs.writeFileSync(path.join(root, 'guides', 'a.md'), '# a');
    expect(listMarkdownFiles(root).sort()).toEqual(['guides/a.md', 'real.md']);
  });
});
