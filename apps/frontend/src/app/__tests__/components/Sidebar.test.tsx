import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Sidebar from '@/app/ui/layout/Sidebar/Sidebar';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import { startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';

const mockUsePathname = jest.fn();
const mockRouter = { push: jest.fn(), replace: jest.fn() };

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => mockRouter,
}));

jest.mock('next/image', () => {
  const MockImage = ({ alt }: any) => <span>{alt}</span>;
  MockImage.displayName = 'MockNextImage';
  return { __esModule: true, default: MockImage };
});

jest.mock('next/link', () => {
  // `prefetch` is consumed by the real next/link and never reaches the DOM.
  // Forwarding it onto a bare <a> makes React warn about a non-boolean
  // attribute, which the console.error spy below turns into a failure.
  const MockLink = ({ children, href, onClick, prefetch, ...rest }: any) => (
    <a href={href} onClick={onClick} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = 'MockNextLink';
  return MockLink;
});

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  useOrgList: jest.fn(),
  usePrimaryOrg: jest.fn(),
}));
jest.mock('@/app/hooks/useSpecialities', () => ({
  useLoadSpecialitiesForPrimaryOrg: jest.fn(),
}));
jest.mock('@/app/lib/routeLoader', () => ({
  startRouteLoader: jest.fn(),
  stopRouteLoader: jest.fn(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));
jest.mock('@/app/stores/profileStore', () => ({
  useUserProfileStore: jest.fn(),
}));

const mockUseOrgStore = useOrgStore as unknown as jest.Mock;
const mockUseUserProfileStore = useUserProfileStore as unknown as jest.Mock;
const mockUsePrimaryOrg = usePrimaryOrg as unknown as jest.Mock;
const mockStartRouteLoader = startRouteLoader as jest.Mock;
const mockStopRouteLoader = stopRouteLoader as jest.Mock;

const ALL_PERMISSIONS = [
  'analytics:view:any',
  'appointments:view:any',
  'appointments:view:own',
  'tasks:view:any',
  'communication:view:any',
  'billing:view:any',
  'companions:view:any',
  'inventory:view:any',
  'integrations:view:any',
  'forms:view:any',
];

type OrgStoreState = {
  status: string;
  primaryOrgId: string | null;
  membershipsByOrgId: Record<string, any> | null;
};

type ProfileStoreState = { profilesByOrgId: Record<string, any> };

let orgState: OrgStoreState;
let profileState: ProfileStoreState;

const setup = (
  overrides: {
    status?: string;
    primaryOrgId?: string | null;
    membership?: any;
    profile?: any;
    primaryOrg?: any;
    pathname?: string;
    collapsed?: boolean;
  } = {}
) => {
  const {
    status = 'loaded',
    primaryOrgId = 'org-1',
    membership = { effectivePermissions: ALL_PERMISSIONS, roleDisplay: 'Owner', roleCode: 'OWNER' },
    profile = { personalDetails: {} },
    primaryOrg = { _id: 'org-1', isVerified: true, type: 'clinic' },
    pathname = '/dashboard',
    collapsed,
  } = overrides;

  orgState = {
    status,
    primaryOrgId,
    membershipsByOrgId: primaryOrgId && membership ? { [primaryOrgId]: membership } : {},
  };
  profileState = {
    profilesByOrgId: primaryOrgId && profile ? { [primaryOrgId]: profile } : {},
  };

  mockUsePathname.mockReturnValue(pathname);
  mockUsePrimaryOrg.mockReturnValue(primaryOrg);
  if (collapsed === true) window.localStorage.setItem('yc_sidebar_collapsed', '1');
  if (collapsed === false) window.localStorage.setItem('yc_sidebar_collapsed', '0');
};

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockUseOrgStore.mockImplementation((selector: any) => selector(orgState));
    mockUseUserProfileStore.mockImplementation((selector: any) => selector(profileState));
    setup();
  });

  it('renders the loading shell while orgs are still loading', () => {
    setup({ status: 'loading', primaryOrg: null, primaryOrgId: null, collapsed: false });

    const { container } = render(<Sidebar />);

    expect(container.querySelector('.sidebar')).toBeInTheDocument();
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it('renders nav routes without loaded orgs when the auth guard is disabled (local UI mode)', () => {
    const original = process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';
    setup({ status: 'loading', primaryOrg: null, primaryOrgId: null, collapsed: false });

    try {
      const { container } = render(<Sidebar />);
      expect(container.querySelectorAll('a').length).toBeGreaterThan(0);
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
      else process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = original;
    }
  });

  it('links the authenticated logo to the owner dashboard and renders enabled routes', () => {
    setup({ pathname: '/organization', collapsed: false });

    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'Yosemite Crew dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveClass('route-disabled');
    expect(screen.getByRole('link', { name: 'Organization' })).not.toHaveClass('route-disabled');
  });

  it('stops the route loader when clicking the already-active route', () => {
    setup({ pathname: '/organization', collapsed: false });

    render(<Sidebar />);
    fireEvent.click(screen.getByRole('link', { name: 'Organization' }));

    expect(mockStopRouteLoader).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('starts the route loader and navigates when clicking an enabled inactive route', () => {
    setup({
      pathname: '/organization',
      membership: { extraPermissions: ['analytics:view:any'], roleDisplay: 'Owner' },
      collapsed: false,
    });

    render(<Sidebar />);
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));

    expect(mockStartRouteLoader).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
  });

  it('does not navigate when clicking a disabled route', () => {
    setup({
      pathname: '/organization',
      membership: { extraPermissions: ['analytics:view:any'], roleDisplay: 'Owner' },
      collapsed: false,
    });

    render(<Sidebar />);
    const finance = screen.getByRole('link', { name: 'Finance' });
    expect(finance).toHaveClass('route-disabled');

    // Disabled to assistive tech too, not only to the eye. Without these it is
    // a greyed link that a screen reader still announces as a destination and a
    // keyboard user can still tab to - an unverified org's Patients entry read
    // as reachable when nothing behind it is.
    expect(finance).toHaveAttribute('aria-disabled', 'true');
    expect(finance).toHaveAttribute('tabindex', '-1');

    fireEvent.click(finance);

    expect(mockStartRouteLoader).not.toHaveBeenCalled();
    expect(mockStopRouteLoader).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('leaves enabled routes focusable and unmarked', () => {
    setup({ pathname: '/dashboard', collapsed: false });

    render(<Sidebar />);
    const dashboard = screen.getByRole('link', { name: 'Dashboard' });

    expect(dashboard).not.toHaveClass('route-disabled');
    expect(dashboard).not.toHaveAttribute('aria-disabled');
    expect(dashboard).not.toHaveAttribute('tabindex');
  });

  it('does not viewport-prefetch the nav routes', () => {
    // Every sidebar route is permanently in the viewport, so the App Router's
    // default fired an RSC request for ALL of them on mount. Measured on dev,
    // five of those (/appointments, /chat, /tasks, /dashboard, /companions) took
    // 3.0-3.8s EACH and ran concurrently with the page's own data against a
    // ~6-connection-per-origin cap: the page you had actually opened queued
    // behind prefetches for pages you had not. Next still prefetches these on
    // hover, which is the point of intent anyway.
    setup({ pathname: '/dashboard', collapsed: false });

    render(<Sidebar />);

    const dashboard = screen.getByRole('link', { name: 'Dashboard' });
    const appointments = screen.getByRole('link', { name: 'Appointments' });

    expect(dashboard).toHaveAttribute('data-prefetch', 'false');
    expect(appointments).toHaveAttribute('data-prefetch', 'false');
  });

  it('toggles the sidebar collapsed state and persists the preference', () => {
    setup({ collapsed: false });

    render(<Sidebar />);
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(window.localStorage.getItem('yc_sidebar_collapsed')).toBe('1');
  });

  it('renders the collapsed icon rail when the stored preference is collapsed', () => {
    setup({ pathname: '/organization', collapsed: true });

    const { container } = render(<Sidebar />);

    expect(container.querySelector('.sidebar-collapsed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    // Route labels collapse to screen-reader-only text.
    expect(screen.getByText('Organization')).toHaveClass('sr-only');
  });

  it('renders the developer portal without waiting for org data to load', () => {
    setup({
      status: 'loading',
      pathname: '/developers/home',
      primaryOrg: null,
      collapsed: false,
    });

    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'Yosemite Crew dashboard' })).toHaveAttribute(
      'href',
      '/developers/home'
    );
    expect(screen.getByText('Developers')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'API Keys' })).toBeInTheDocument();
    // Developer routes are always enabled.
    expect(screen.getByRole('link', { name: 'API Keys' })).not.toHaveClass('route-disabled');
  });

  it('falls back to the role code when the membership has no display role', () => {
    setup({
      membership: { effectivePermissions: ALL_PERMISSIONS, roleCode: 'OWNER' },
      collapsed: false,
    });

    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'Yosemite Crew dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
  });

  it('defaults to the owner logo target and disables routes when there is no membership', () => {
    setup({ pathname: '/organization', membership: null, collapsed: false });

    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'Yosemite Crew dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    // No effective permissions, so permissioned routes are disabled.
    expect(screen.getByRole('link', { name: 'Finance' })).toHaveClass('route-disabled');
    // Organization needs no permission, but the org is present and verified so it stays enabled.
    expect(screen.getByRole('link', { name: 'Organization' })).not.toHaveClass('route-disabled');
  });

  it('disables routes when the primary org is missing', () => {
    setup({ pathname: '/organization', primaryOrg: null, collapsed: false });

    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'Organization' })).toHaveClass('route-disabled');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveClass('route-disabled');
  });

  it('disables verification-gated routes when the org is not verified', () => {
    setup({
      pathname: '/organization',
      primaryOrg: { _id: 'org-1', isVerified: false, type: 'clinic' },
      collapsed: false,
    });

    render(<Sidebar />);

    // Appointments requires a verified org.
    expect(screen.getByRole('link', { name: 'Appointments' })).toHaveClass('route-disabled');
    // Organization does not require verification.
    expect(screen.getByRole('link', { name: 'Organization' })).not.toHaveClass('route-disabled');
  });

  it('resolves the logo target to appointments for non-owner roles', () => {
    setup({
      membership: { extraPermissions: ALL_PERMISSIONS, roleDisplay: 'Veterinarian' },
      collapsed: false,
    });

    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'Yosemite Crew dashboard' })).toHaveAttribute(
      'href',
      '/appointments'
    );
  });
});
