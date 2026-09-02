import { loadCorpus } from '@/app/features/docs/corpus';
import { renderDoc } from '@/app/features/docs/render';

/**
 * The corpus is untrusted input: this is an open-source repository that accepts
 * documentation pull requests, so a contributed page is attacker-controlled
 * markdown. These tests are the security boundary, not a formatting check.
 */
describe('renderDoc sanitisation', () => {
  const corpus = loadCorpus();
  const asEntry = (body: string) => ({
    ...corpus[0],
    file: 'test.md',
    body,
  });

  const render = async (markdown: string) => (await renderDoc(asEntry(markdown), corpus)).html;

  const carriesExecutableAttribute = (html: string) =>
    /<[^>]+\son[a-z]+\s*=/i.test(html) ||
    /<script|<iframe|<object|<embed|<form/i.test(html) ||
    /<[^>]+\sstyle\s*=/i.test(html) ||
    /(?:href|src)\s*=\s*["']?\s*(?:javascript|data):/i.test(html);

  it.each([
    ['a raw script tag', '<script>alert(1)</script>'],
    ['an onerror attribute', '<img src=x onerror="alert(1)">'],
    ['an attribute smuggled onto a heading', '## Bug {#x onclick="alert(1)"}'],
    ['a javascript: link', '[click](javascript:alert(1))'],
    ['an inline style', '<b style="position:fixed;top:0">x</b>'],
    ['an iframe', '<iframe src="https://evil.test"></iframe>'],
    ['an svg onload', '<svg onload="alert(1)"></svg>'],
    ['a data: link', '[x](data:text/html;base64,PHNjcmlwdD4=)'],
    ['a form', '<form action="//evil"><input name="p"></form>'],
    ['a mouseover handler', '<a href="/x" onmouseover="alert(1)">y</a>'],
    ['an object tag', '<object data="//evil"></object>'],
    ['a meta refresh', '<meta http-equiv="refresh" content="0;url=//evil">'],
  ])('strips %s', async (_label, markdown) => {
    expect(carriesExecutableAttribute(await render(markdown))).toBe(false);
  });

  /*
   * The attribute-injection case above is the one a hand-rolled allowlist gets
   * wrong: a validator that walks only raw-HTML nodes never sees an attribute
   * a markdown plugin wrote onto a heading. rehype-sanitize runs last over the
   * finished tree, so the shape of the source does not matter.
   */
  it('renders a smuggled attribute as text rather than an attribute', async () => {
    const html = await render('## Bug {#x onclick="alert(1)"}');
    expect(html).toMatch(/<h2 id="[^"]*">/);
    /*
     * The braces survive as visible TEXT, which is correct and harmless - this
     * pipeline has no markdown-it-attrs, so `{...}` is never interpreted. The
     * assertion has to be about an ATTRIBUTE on an element, because a substring
     * check would flag the literal text and read as a vulnerability that is not
     * there.
     */
    expect(html).not.toMatch(/<[^>]+\sonclick\s*=/i);
    expect(html).toContain('Bug {#x onclick="alert(1)"}');
  });

  it('keeps heading ids unprefixed, because they are a published URL surface', async () => {
    const html = await render('## Prerequisites');
    expect(html).toContain('id="prerequisites"');
    expect(html).not.toContain('user-content-');
  });

  it('keeps highlighter class names, which the CSP-safe theme needs', async () => {
    const html = await render('```ts\nconst a: number = 1;\n```');
    expect(html).toMatch(/hljs/);
    expect(html).not.toMatch(/\sstyle=/);
  });

  it('marks external links noopener and leaves internal ones alone', async () => {
    const html = await render('[out](https://example.com) and [in](/apps/backend)');
    expect(html).toMatch(/rel="noopener noreferrer"/);
    expect(html).toMatch(/href="\/docs\/apps\/backend"/);
  });
});

describe('renderDoc over the real corpus', () => {
  const corpus = loadCorpus();

  it('renders every page without throwing', async () => {
    const results = await Promise.all(
      corpus.map(async (entry) => ({
        file: entry.file,
        html: (await renderDoc(entry, corpus)).html,
      }))
    );
    const empty = results.filter((result) => result.html.trim().length < 20);
    expect(empty).toEqual([]);
    expect(results).toHaveLength(corpus.length);
  });

  /*
   * A docs site whose links 404 is the failure this whole migration exists to
   * fix, so a link that resolves to nothing fails the build rather than
   * shipping.
   */
  it('leaves no broken internal link anywhere in the corpus', async () => {
    const broken: Record<string, string[]> = {};
    for (const entry of corpus) {
      const { brokenLinks } = await renderDoc(entry, corpus);
      if (brokenLinks.length) broken[entry.file] = brokenLinks;
    }
    expect(broken).toEqual({});
  });

  it('extracts a table of contents', async () => {
    const total = (
      await Promise.all(corpus.map(async (e) => (await renderDoc(e, corpus)).toc.length))
    ).reduce((sum, count) => sum + count, 0);
    expect(total).toBeGreaterThan(300);
  });
});
