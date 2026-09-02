import { loadCorpus } from '@/app/features/docs/corpus';
import { buildSearchIndex, toSearchText } from '@/app/features/docs/searchIndex';

describe('search index', () => {
  const corpus = loadCorpus();
  const index = buildSearchIndex(corpus);
  const haystack = index
    .map((doc) => doc.text)
    .join(' ')
    .toLowerCase();

  it('indexes every page with a title, href and section', () => {
    expect(index).toHaveLength(corpus.length);
    for (const doc of index) {
      expect(doc.title.trim()).not.toBe('');
      expect(doc.href.startsWith('/docs')).toBe(true);
      expect(doc.section.trim()).not.toBe('');
    }
  });

  /*
   * The security property. One guide carries a Stream API key inside a ```ts
   * fence, and a search index is a browser artifact - anything in it is public
   * regardless of what the page renders.
   */
  it('excludes fenced code from the indexed text', () => {
    expect(toSearchText('before\n\n```ts\nconst SECRET = "abc123xyz";\n```\n\nafter')).toBe(
      'before after'
    );
  });

  it('leaks no token that appears only inside a fence', () => {
    const stripped = (body: string) => body.replace(/^```[\s\S]*?^```/gm, ' ');
    const leaked: string[] = [];
    for (const entry of corpus) {
      const fences = entry.body.match(/^```[\s\S]*?^```/gm) ?? [];
      for (const fence of fences) {
        for (const token of fence.match(/[A-Za-z0-9_]{12,}/g) ?? []) {
          const onlyInFence = corpus.every((other) => !stripped(other.body).includes(token));
          if (onlyInFence && haystack.includes(token.toLowerCase())) leaked.push(token);
        }
      }
    }
    expect(leaked).toEqual([]);
  });

  /*
   * The opposite direction, which is just as important: stripping inline code
   * as well would be the easy over-correction and would gut the corpus. The 36
   * router pages are almost entirely inline code, so these terms are exactly
   * what a reader searches for.
   */
  it('keeps inline code, which is most of the router reference', () => {
    expect(toSearchText('call `requireWebAuth` first')).toBe('call requireWebAuth first');
    for (const term of ['requirewebauth', 'organisationid']) {
      expect(haystack).toContain(term);
    }
  });

  it('keeps link text and drops the target', () => {
    expect(toSearchText('see [the availability API](./availability.md)')).toBe(
      'see the availability API'
    );
  });

  it('drops heading marks and html comments', () => {
    expect(toSearchText('## Heading\n\n<!-- hidden -->\n\nbody')).toBe('Heading body');
  });

  it('stays far smaller than the plugin index it replaces', () => {
    const bytes = Buffer.byteLength(JSON.stringify(index));
    expect(bytes).toBeLessThan(300 * 1024);
  });
});
