import { render, screen } from '@testing-library/react';
import DocsShell from '@/app/features/docs/DocsShell';
import { loadCorpus } from '@/app/features/docs/corpus';
import { renderDoc } from '@/app/features/docs/render';
import type { NavNode } from '@/app/features/docs/docsNav';
import type { TocEntry } from '@/app/features/docs/render';

jest.mock('next/navigation', () => ({ usePathname: () => '/docs' }));

const NAV: NavNode[] = [{ kind: 'link', id: 'overview', title: 'Overview', href: '/docs' }];

const TOC: TocEntry[] = [
  { id: 'install', text: 'Install', depth: 2 },
  { id: 'flags', text: 'Flags', depth: 3 },
];

const corpus = loadCorpus();

/** Build the real sanitised tree the page would pass in, from given markdown. */
const treeFor = async (markdown: string) =>
  (await renderDoc({ ...corpus[0], file: 'test.md', body: markdown }, corpus)).tree;

const shell = async (markdown: string, overrides: Partial<Parameters<typeof DocsShell>[0]> = {}) =>
  render(
    <DocsShell
      nav={NAV}
      toc={TOC}
      title="Getting Started"
      breadcrumb={['Docs', 'Guides', 'Getting Started']}
      tree={await treeFor(markdown)}
      editUrl="https://github.com/YosemiteCrew/Yosemite-Crew/edit/dev/apps/frontend/content/docs/test.md"
      {...overrides}
    />
  );

describe('DocsShell', () => {
  it('renders the title and the document body', async () => {
    await shell('Hello from the corpus.');
    expect(screen.getByRole('heading', { level: 1, name: 'Getting Started' })).toBeInTheDocument();
    expect(screen.getByText('Hello from the corpus.')).toBeInTheDocument();
  });

  it('renders the breadcrumb trail with separators between, not before', async () => {
    const { container } = await shell('x');
    const crumbs = container.querySelector('.DocsBreadcrumb');
    expect(crumbs).toHaveTextContent('Docs/Guides/Getting Started');
    expect(container.querySelectorAll('.DocsBreadcrumbSep')).toHaveLength(2);
  });

  it('links to the page source on GitHub in a new tab, safely', async () => {
    await shell('x');
    const edit = screen.getByRole('link', { name: 'Edit this page on GitHub' });
    expect(edit).toHaveAttribute('target', '_blank');
    expect(edit).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the sidebar and the search box', async () => {
    await shell('x');
    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search the documentation' })).toBeInTheDocument();
  });

  it('renders the table of contents, nesting depth-3 entries', async () => {
    const { container } = await shell('x');
    expect(screen.getByRole('link', { name: 'Install' })).toHaveAttribute('href', '#install');
    expect(container.querySelectorAll('.DocsTocItem')).toHaveLength(1);
    expect(container.querySelectorAll('.DocsTocItemNested')).toHaveLength(1);
  });

  /*
   * A page with no headings would otherwise render an empty "On this page"
   * rail, which reads as a broken sidebar rather than an absent one.
   */
  it('omits the table of contents entirely when there are no headings', async () => {
    const { container } = await shell('x', { toc: [] });
    expect(container.querySelector('.DocsToc')).toBeNull();
    expect(screen.queryByText('On this page')).not.toBeInTheDocument();
  });

  /*
   * globals.css scopes `--color-text-tertiary: #66635f` to
   * `body:has([data-yc-app])`. Without the wrapper the token falls back to
   * #8f8984, which fails 4.5:1 on bone in light mode only - a contrast bug
   * that looks like a shade difference. `display: contents` keeps it boxless.
   */
  it('keeps the data-yc-app wrapper that scopes the contrast tokens', async () => {
    const { container } = await shell('x');
    const wrapper = container.querySelector('[data-yc-app]');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveStyle({ display: 'contents' });
  });
});

/*
 * The security boundary, asserted where it actually matters: through the real
 * renderDoc pipeline and into a mounted DOM.
 *
 * render.test.ts proves the sanitiser strips these from the tree. This proves
 * the rendering step does not put them back. CodeQL reports js/stored-xss on
 * the `toJsxRuntime` call because it cannot model rehype-sanitize as a
 * sanitiser and so treats corpus markdown as reaching the DOM unchecked; these
 * are the tests that say otherwise, and they fail if the sanitiser is removed
 * from the pipeline.
 */
describe('DocsShell does not reintroduce markup the sanitiser removed', () => {
  it.each([
    ['a raw script tag', '<script>alert(1)</script>'],
    ['an onerror handler', '<img src=x onerror="alert(1)">'],
    ['an iframe', '<iframe src="https://evil.test"></iframe>'],
    ['a javascript: link', '[click](javascript:alert(1))'],
    ['an svg onload', '<svg onload="alert(1)"></svg>'],
    ['an inline style', '<b style="position:fixed;top:0">x</b>'],
  ])('drops %s', async (_label, markdown) => {
    const { container } = await shell(markdown);
    const body = container.querySelector('.DocsBody');
    expect(body).not.toBeNull();

    expect(body!.querySelector('script, iframe, object, embed, form')).toBeNull();
    for (const el of Array.from(body!.querySelectorAll('*'))) {
      for (const attr of Array.from(el.attributes)) {
        expect(attr.name).not.toMatch(/^on/i);
        expect(attr.name).not.toBe('style');
        if (attr.name === 'href' || attr.name === 'src') {
          expect(attr.value).not.toMatch(/^\s*(javascript|data):/i);
        }
      }
    }
  });
});
