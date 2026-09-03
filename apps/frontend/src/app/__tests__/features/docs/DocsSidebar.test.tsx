import { fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
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
});

/*
 * Below 860px the sidebar is a disclosure. Expanded, it stacked the whole link
 * list above the article: measured on dev at 390px wide, the requested page's
 * h1 sat at 919px, so a reader landing on a deep link met a screen and a bit of
 * navigation before the title.
 *
 * The open/closed state lives in the DOM rather than in a media query, because
 * the stylesheet is what decides whether it means anything - these assert the
 * state the CSS keys off.
 */
describe('DocsSidebar mobile disclosure', () => {
  it('starts closed, which is what keeps the article first on a phone', () => {
    const { container } = render(<DocsSidebar nav={NAV} />);
    const toggle = screen.getByRole('button', { name: /Documentation menu/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('.DocsNavItems')).toHaveAttribute('data-mobile-open', 'false');
  });

  /*
   * Asserted against the SERVER markup, not the mounted DOM.
   *
   * The close-on-navigate effect also runs on mount, so in a client render the
   * initial state is overwritten before anything can observe it - flipping the
   * useState default to `true` passes every other test in this file. What it
   * would actually change is the HTML the phone paints before hydration, and
   * what a reader with JavaScript off gets permanently: a fully expanded nav
   * above the article, which is the bug this disclosure exists to fix.
   */
  it('renders closed on the server, before any effect can correct it', () => {
    const html = renderToStaticMarkup(<DocsSidebar nav={NAV} />);
    expect(html).toContain('data-mobile-open="false"');
    expect(html).not.toContain('data-mobile-open="true"');
  });

  it('points the toggle at the list it controls', () => {
    const { container } = render(<DocsSidebar nav={NAV} />);
    const toggle = screen.getByRole('button', { name: /Documentation menu/ });
    const controlled = toggle.getAttribute('aria-controls');
    expect(controlled).toBe('docs-nav-items');
    expect(container.querySelector(`#${controlled}`)).toBe(
      container.querySelector('.DocsNavItems')
    );
  });

  it('opens and closes on click', () => {
    const { container } = render(<DocsSidebar nav={NAV} />);
    const toggle = screen.getByRole('button', { name: /Documentation menu/ });

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('.DocsNavItems')).toHaveAttribute('data-mobile-open', 'true');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  /*
   * Tapping a link navigates. Without this the drawer stays open on top of the
   * page it just took you to, which is the same complaint as the original bug.
   */
  it('closes itself when the route changes', () => {
    const { container, rerender } = render(<DocsSidebar nav={NAV} />);
    fireEvent.click(screen.getByRole('button', { name: /Documentation menu/ }));
    expect(container.querySelector('.DocsNavItems')).toHaveAttribute('data-mobile-open', 'true');

    mockPathname.mockReturnValue('/docs/guides/notify');
    rerender(<DocsSidebar nav={NAV} />);

    expect(container.querySelector('.DocsNavItems')).toHaveAttribute('data-mobile-open', 'false');
  });

  it('still renders every link, so the nav is only hidden by CSS', () => {
    render(<DocsSidebar nav={NAV} />);
    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notification Setup' })).toBeInTheDocument();
  });
});
