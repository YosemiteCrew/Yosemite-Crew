import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { Schema } from 'hast-util-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeHighlight from 'rehype-highlight';
import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';
import { resolveDocLink } from './links';
import type { DocEntry } from './corpus';

/**
 * Markdown to HTML for the documentation corpus.
 *
 * SANITISATION IS THE WHOLE SECURITY STORY HERE, and it is deliberately not
 * hand-rolled. This is an open-source repository that accepts documentation
 * pull requests, so the markdown is untrusted input. A validator that inspects
 * only raw-HTML nodes is not enough: markdown constructs carry attributes too,
 * and an allowlist that walks one and not the other has a hole exactly where an
 * attacker would look.
 *
 * `rehype-sanitize` runs LAST, over the finished HAST, so it sees every element
 * and every attribute regardless of which plugin produced it. Anything not on
 * the schema below is dropped - there is no path around it.
 *
 * Order matters: raw HTML is parsed, then headings get ids, then code is
 * highlighted, and only then is the whole tree sanitised. Putting sanitise
 * earlier would let a later plugin reintroduce unsanitised attributes.
 */

export interface TocEntry {
  id: string;
  text: string;
  depth: 2 | 3;
}

export interface RenderedDoc {
  /** Sanitised HAST, rendered to React elements - never to an HTML string. */
  tree: Root;
  toc: TocEntry[];
  brokenLinks: string[];
}

/**
 * Extends the default schema with exactly what the corpus needs:
 * - `className` on code/span for the highlighter's token classes
 * - `id` on headings for anchors and the table of contents
 *
 * Note what is NOT here: no `style`, no `on*` handlers, no `srcset`, no
 * arbitrary data attributes. rehype-sanitize's default already strips event
 * handlers and javascript: URLs; this only widens it where a feature needs it.
 */
const schema: Schema = {
  ...defaultSchema,
  /*
   * rehype-sanitize prefixes every id with `user-content-` by default, to stop
   * a crafted id clobbering a document property. That protection is turned off
   * here for one concrete reason: heading anchors are a published URL surface.
   * Docusaurus emitted `#prerequisites`, external links to this documentation
   * use it, and `#user-content-prerequisites` would break every one of them.
   *
   * What is given up is narrow. Ids are slugified heading text, so they cannot
   * carry quotes or markup, and every dangerous ATTRIBUTE is still stripped by
   * the schema below - this only affects the id VALUE. Clobbering is also a far
   * weaker vector than script injection, which stays fully blocked.
   */
  clobberPrefix: '',
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ['className']],
    span: [...(defaultSchema.attributes?.span ?? []), ['className']],
    div: [...(defaultSchema.attributes?.div ?? []), ['className']],
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'id'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'id'],
    h5: [...(defaultSchema.attributes?.h5 ?? []), 'id'],
    h6: [...(defaultSchema.attributes?.h6 ?? []), 'id'],
    a: [...(defaultSchema.attributes?.a ?? []), 'id', 'rel', 'target', ['className']],
  },
};

const textOf = (node: Element): string => {
  let out = '';
  visit(node, 'text', (child: { value: string }) => {
    out += child.value;
  });
  return out.trim();
};

/** Rewrites in-corpus links and collects the ones that point nowhere. */
const rewriteLinks =
  (entry: DocEntry, corpus: DocEntry[], broken: string[]) => () => (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'a') return;
      const href = node.properties?.href;
      if (typeof href !== 'string') return;
      const resolved = resolveDocLink(href, entry.file, corpus);
      node.properties.href = resolved.href;
      if (resolved.broken) broken.push(href);
      // External links open away from the docs and must not leak the referrer
      // opener; same-origin links keep default behaviour.
      if (/^https?:\/\//i.test(resolved.href)) {
        node.properties.target = '_blank';
        // hast models `rel` as a token list, not a space-joined string.
        node.properties.rel = ['noopener', 'noreferrer'];
      }
    });
  };

/** Collects h2/h3 for the on-page table of contents. */
const collectToc = (toc: TocEntry[]) => () => (tree: Root) => {
  visit(tree, 'element', (node: Element) => {
    if (node.tagName !== 'h2' && node.tagName !== 'h3') return;
    const id = node.properties?.id;
    if (typeof id !== 'string') return;
    toc.push({ id, text: textOf(node), depth: node.tagName === 'h2' ? 2 : 3 });
  });
};

export const renderDoc = async (entry: DocEntry, corpus: DocEntry[]): Promise<RenderedDoc> => {
  const toc: TocEntry[] = [];
  const brokenLinks: string[] = [];

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: 'wrap',
      properties: { className: ['DocsHeadingAnchor'] },
    })
    .use(rewriteLinks(entry, corpus, brokenLinks))
    .use(collectToc(toc))
    // Class-name highlighting, never inline styles: the app serves a strict CSP
    // and a highlighter that injects `style=` would be silently blocked.
    .use(rehypeHighlight, { detect: false, ignoreMissing: true })
    // Last, over the finished tree. See the header comment.
    .use(rehypeSanitize, schema);

  const tree = (await processor.run(processor.parse(entry.body))) as Root;

  return { tree, toc, brokenLinks };
};
