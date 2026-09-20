import { fireEvent, render, screen } from '@testing-library/react';
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
