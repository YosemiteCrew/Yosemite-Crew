import { fireEvent, render, screen, within } from '@testing-library/react';
import DocsSidebar from '@/app/features/docs/DocsSidebar';
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

  it('toggles a section', () => {
    render(<DocsSidebar nav={NAV} />);
    const head = screen.getByRole('button', { name: /Backend API/ });
    fireEvent.click(head);
    expect(head).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(head);
    expect(head).toHaveAttribute('aria-expanded', 'false');
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
});
