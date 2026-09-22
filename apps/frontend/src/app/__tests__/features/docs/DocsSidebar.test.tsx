import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import DocsSidebar, { DOCS_NAV_NO_JS_CSS } from '@/app/features/docs/DocsSidebar';
import type { NavNode } from '@/app/features/docs/docsNav';

const mockPathname = jest.fn(() => '/docs');
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

const NAV: NavNode[] = [
  { kind: 'link', id: 'overview', title: 'Overview', href: '/docs' },
  {
    kind: 'section',
    label: 'Guides',
    items: [{ kind: 'link', id: 'g1', title: 'Notification Setup', href: '/docs/guides/notify' }],
  },
  {
    kind: 'section',
    label: 'Backend API',
    collapsed: true,
    items: [{ kind: 'link', id: 'r1', title: 'User API', href: '/docs/apps/backend/api/user' }],
  },
];

describe('DocsSidebar', () => {
  beforeEach(() => mockPathname.mockReturnValue('/docs'));

  it('renders every link as a real anchor, so the nav works without JS', () => {
    render(<DocsSidebar nav={NAV} />);
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/docs');
    expect(screen.getByRole('link', { name: 'Notification Setup' })).toBeInTheDocument();
  });

  it('marks the current page', () => {
    render(<DocsSidebar nav={NAV} />);
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  });

  it('starts a collapsed section closed', () => {
    render(<DocsSidebar nav={NAV} />);
    const head = screen.getByRole('button', { name: /Backend API/ });
    expect(head).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles a section, and the body follows the head', () => {
    render(<DocsSidebar nav={NAV} />);
    const head = screen.getByRole('button', { name: /Backend API/ });
    const body = () => document.getElementById('docs-section-backend-api');

    expect(body()).toHaveAttribute('data-expanded', 'false');

    fireEvent.click(head);
    expect(head).toHaveAttribute('aria-expanded', 'true');
    expect(body()).toHaveAttribute('data-expanded', 'true');

    fireEvent.click(head);
    expect(head).toHaveAttribute('aria-expanded', 'false');
    expect(body()).toHaveAttribute('data-expanded', 'false');
  });

  /*
   * Deep-linking into one of the 36 router references must not land the reader
   * in a collapsed tree with no idea where they are.
   */
  it('opens a collapsed section that contains the current page', () => {
    mockPathname.mockReturnValue('/docs/apps/backend/api/user');
    render(<DocsSidebar nav={NAV} />);
    expect(screen.getByRole('button', { name: /Backend API/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('leaves an uncollapsed section open', () => {
    render(<DocsSidebar nav={NAV} />);
    expect(screen.getByRole('button', { name: /Guides/ })).toHaveAttribute('aria-expanded', 'true');
  });

  /*
   * The phone disclosure. jsdom loads no stylesheet, so these assert the state
   * the media query reads - `aria-expanded` and `data-open` - not visibility.
   * Whether the tree is actually hidden at 390px and still shown at 1280px is
   * a layout question, and e2e/docs-mobile.spec.ts is where it is measured.
   */
  describe('the phone navigation menu', () => {
    const menuButton = () => screen.getByRole('button', { name: /Documentation menu/ });
    const tree = () => document.getElementById('docs-nav-tree') as HTMLElement;

    it('starts closed and names the region it controls', () => {
      render(<DocsSidebar nav={NAV} />);
      expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
      expect(menuButton()).toHaveAttribute('aria-controls', 'docs-nav-tree');
      expect(tree()).toHaveAttribute('data-open', 'false');
    });

    it('opens the tree, leaving the links real anchors', () => {
      render(<DocsSidebar nav={NAV} />);
      fireEvent.click(menuButton());

      expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
      expect(tree()).toHaveAttribute('data-open', 'true');

      const link = within(tree()).getByRole('link', { name: 'Overview' });
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/docs');
      link.focus();
      expect(link).toHaveFocus();
    });

    it('closes again on a second press', () => {
      render(<DocsSidebar nav={NAV} />);
      fireEvent.click(menuButton());
      fireEvent.click(menuButton());
      expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    });

    /*
     * Next keeps this component mounted across a docs-to-docs route change, so
     * an open menu would otherwise survive the tap that navigated - putting the
     * whole tree back above the article on every page after the first.
     */
    it('closes when a link is followed', () => {
      render(<DocsSidebar nav={NAV} />);
      fireEvent.click(menuButton());
      expect(menuButton()).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(within(tree()).getByRole('link', { name: 'Notification Setup' }));

      expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
      expect(tree()).toHaveAttribute('data-open', 'false');
    });

    it('stays open when a section is expanded', () => {
      render(<DocsSidebar nav={NAV} />);
      fireEvent.click(menuButton());
      fireEvent.click(screen.getByRole('button', { name: /Backend API/ }));
      expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    });
  });
  /*
   * The no-JavaScript floor. These assert the SERVER markup, because that is
   * the only artefact a scripting-off browser ever gets - `render` here has
   * already run the client, where none of this applies.
   */
  describe('the no-JavaScript floor', () => {
    const serverHtml = () => renderToStaticMarkup(<DocsSidebar nav={NAV} />);

    it('ships the override inside noscript, the one element a running browser ignores', () => {
      expect(serverHtml()).toContain(`<noscript><style>${DOCS_NAV_NO_JS_CSS}</style></noscript>`);
    });

    it('reveals the collapsed tree and withdraws the control that cannot work', () => {
      expect(DOCS_NAV_NO_JS_CSS).toContain('.DocsNavTree[data-open=false]{display:block}');
      expect(DOCS_NAV_NO_JS_CSS).toContain('.DocsNavToggle{display:none}');
      expect(serverHtml()).toContain('class="DocsNavTree" data-open="false"');
    });

    /*
     * A section declared `collapsed` holds the largest part of the tree, and
     * with scripting off nothing can ever open it - so the override has to
     * reach it too. It can only do that because the body is closed by
     * `data-expanded`: an override of `hidden` is unreachable from here at any
     * specificity or importance, since Tailwind's preflight declares
     * `[hidden]{display:none!important}` inside a cascade layer and the
     * important origin ranks a layered declaration above an unlayered one.
     */
    it('reveals a section that was declared collapsed', () => {
      expect(DOCS_NAV_NO_JS_CSS).toContain('.DocsNavSection [data-expanded=false]{display:block}');
      expect(serverHtml()).toContain('data-expanded="false"');
    });

    /*
     * The chevron is a `+` drawn from React state, so revealing the body
     * without withdrawing it leaves a closed marker over open content.
     */
    it('withdraws the chevron, which cannot follow the state it reports', () => {
      expect(DOCS_NAV_NO_JS_CSS).toContain('.DocsNavChevron{display:none}');
    });

    /*
     * The attribute that made the override possible at all. `hidden` is the
     * one way of closing the body this cannot reopen, so its absence from the
     * served markup is the fix, not an incidental detail of it.
     */
    it('closes the body with no attribute preflight can pin shut', () => {
      expect(serverHtml()).not.toContain('hidden=""');
      expect(DOCS_NAV_NO_JS_CSS).not.toContain('[hidden]');
    });

    /*
     * The other half of that cascade argument, which lives in a file this
     * component only imports indirectly: the rule that closes the section has
     * to stay unlayered and unimportant, or the override above stops winning
     * and nothing here would notice.
     */
    it('is outranking an ordinary unlayered rule, not an important layered one', () => {
      const css = readFileSync(join(process.cwd(), 'src/app/features/docs/docs.css'), 'utf8');
      // The comment above the rule quotes both of the strings this forbids.
      const rules = css.replaceAll(/\/\*[\s\S]*?\*\//g, '');

      expect(rules).toMatch(/\.DocsNavTree \[data-expanded='false'\]\s*{[^}]*display:\s*none;/);
      expect(rules).not.toContain('@layer');
      expect(rules).not.toContain('!important');
    });

    /*
     * `.DocsNavSection` is not ours alone - `features/developers/pages/
     * DeveloperDocs` renders the same class. A collapse rule resting on it
     * would close a section on that page too, while the override that reopens
     * one is scoped `.DocsNav`, which that page has not got: the defect this
     * whole file is about, recurring where nothing looks. So the rule hangs off
     * `.DocsNavTree`, which is this feature's alone, and the shared class must
     * not carry a `[data-expanded]` rule at all.
     */
    it('closes the section through a class no other feature renders', () => {
      const css = readFileSync(join(process.cwd(), 'src/app/features/docs/docs.css'), 'utf8');
      const rules = css.replaceAll(/\/\*[\s\S]*?\*\//g, '');

      expect(rules).not.toMatch(/\.DocsNavSection\s*\[data-expanded/);
    });

    /*
     * `<style>` is a raw-text element: React writes these characters through
     * unescaped in the server markup, and a browser will not decode an entity
     * inside one. A quote reaching here would therefore ship as `&#x27;` and
     * silently void the selector it sits in, with nothing failing anywhere.
     */
    it('uses no character that would have to survive escaping', () => {
      expect(DOCS_NAV_NO_JS_CSS).not.toMatch(/['"&<>]/);
    });

    /*
     * The reason this is a stylesheet rather than a different server render.
     * Serving the tree open and collapsing it on mount would put the whole nav
     * above the article on every phone load - the defect the disclosure exists
     * to remove - so the markup must be byte-identical to the collapsed one.
     */
    it('leaves the served state collapsed, so a phone paints no tree before hydrating', () => {
      expect(serverHtml()).toContain('aria-controls="docs-nav-tree"');
      expect(serverHtml()).not.toContain('data-open="true"');
    });
  });
});
