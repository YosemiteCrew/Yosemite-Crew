import { loadCorpus } from '@/app/features/docs/corpus';
import { isDocsHref, resolveDocLink } from '@/app/features/docs/links';

describe('resolveDocLink', () => {
  const corpus = loadCorpus();
  const from = 'apps/backend/routers/user.md';

  it('leaves external links untouched', () => {
    for (const href of [
      'https://example.com/x',
      'http://example.com',
      '//cdn.example.com/a.js',
      'mailto:someone@example.com',
    ]) {
      expect(resolveDocLink(href, from, corpus)).toEqual({ href, broken: false });
    }
  });

  it('leaves a bare anchor alone', () => {
    expect(resolveDocLink('#section', from, corpus)).toEqual({
      href: '#section',
      broken: false,
    });
  });

  /*
   * Relative links are supported rather than banned. `./x.md` is the universal
   * markdown convention and what an outside contributor will write; refusing it
   * would turn a working link into a CI rejection on someone's first docs PR.
   */
  it('resolves a sibling relative link', () => {
    const sibling = corpus.find((entry) => entry.file === 'apps/backend/routers/availability.md');
    expect(sibling).toBeDefined();
    expect(resolveDocLink('./availability.md', from, corpus)).toEqual({
      href: sibling!.href,
      broken: false,
    });
  });

  it('resolves a parent-directory relative link', () => {
    const parent = corpus.find((entry) => entry.file === 'apps/backend/index.md');
    expect(parent).toBeDefined();
    expect(resolveDocLink('../index.md', from, corpus)).toEqual({
      href: parent!.href,
      broken: false,
    });
  });

  it('keeps the anchor when resolving a relative link', () => {
    const sibling = corpus.find((entry) => entry.file === 'apps/backend/routers/availability.md');
    expect(resolveDocLink('./availability.md#post-', from, corpus).href).toBe(
      `${sibling!.href}#post-`
    );
  });

  it('resolves a site-absolute slug', () => {
    const target = corpus.find((entry) => entry.slug === '/apps/backend');
    expect(target).toBeDefined();
    expect(resolveDocLink('/apps/backend', from, corpus)).toEqual({
      href: target!.href,
      broken: false,
    });
  });

  it('reports a relative link that points at nothing', () => {
    expect(resolveDocLink('./not-a-page.md', from, corpus)).toEqual({
      href: './not-a-page.md',
      broken: true,
    });
  });

  /*
   * A site-absolute link outside the corpus is an app route, not a docs page,
   * so it must pass through rather than be reported broken.
   */
  it('passes through a site-absolute link to an app route', () => {
    expect(resolveDocLink('/developers/signup', from, corpus)).toEqual({
      href: '/developers/signup',
      broken: false,
    });
  });

  it('handles an empty href', () => {
    expect(resolveDocLink('', from, corpus)).toEqual({ href: '', broken: false });
  });
});

describe('isDocsHref', () => {
  it('recognises docs URLs and rejects look-alikes', () => {
    expect(isDocsHref('/docs')).toBe(true);
    expect(isDocsHref('/docs/apps/backend')).toBe(true);
    expect(isDocsHref('/documentation')).toBe(false);
    expect(isDocsHref('/developers/docs')).toBe(false);
  });
});
