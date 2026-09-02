import {
  findBySegments,
  findBySlug,
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
