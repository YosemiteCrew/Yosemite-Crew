import React from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import PhoneShell, { PHONE_PRIMARY_ACTION_EVENT } from '@/app/ui/layout/PhoneShell/PhoneShell';
import { usePhoneShellStore } from '@/app/ui/layout/PhoneShell/phoneShellStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import { PERMISSIONS } from '@/app/lib/permissions';

const mockUsePathname = jest.fn();
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/image', () => {
  const MockImage = ({ alt }: any) => <span>{alt}</span>;
  MockImage.displayName = 'MockNextImage';
  return { __esModule: true, default: MockImage };
});

jest.mock('@/app/stores/orgStore', () => ({ useOrgStore: jest.fn() }));
jest.mock('@/app/hooks/useOrgSelectors', () => ({ usePrimaryOrg: jest.fn() }));
jest.mock('@/app/lib/routeLoader', () => ({
  startRouteLoader: jest.fn(),
  stopRouteLoader: jest.fn(),
}));

const mockUseOrgStore = useOrgStore as unknown as jest.Mock;
const mockUsePrimaryOrg = usePrimaryOrg as unknown as jest.Mock;

const setViewport = (isPhone: boolean) => {
  (globalThis as { matchMedia: unknown }).matchMedia = jest.fn().mockReturnValue({
    matches: isPhone,
    media: '(max-width: 767px)',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
};

const setOrg = ({
  verified = true,
  permissions = Object.values(PERMISSIONS) as string[],
}: { verified?: boolean; permissions?: string[] } = {}) => {
  mockUsePrimaryOrg.mockReturnValue({
    _id: 'org-1',
    name: 'Alpenblick Clinic',
    isVerified: verified,
  });
  mockUseOrgStore.mockImplementation((selector: any) =>
    selector({
      primaryOrgId: 'org-1',
      // Permissions resolve from role + extras, not the stored snapshot.
      membershipsByOrgId: { 'org-1': { extraPermissions: permissions } },
    })
  );
};

describe('PhoneShell', () => {
  const originalMatchMedia = globalThis.matchMedia;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue('/dashboard');
    setOrg();
    act(() => usePhoneShellStore.getState().setChatUnread(0));
  });

  afterAll(() => {
    globalThis.matchMedia = originalMatchMedia;
  });

  it('renders nothing on tablet/desktop viewports', () => {
    setViewport(false);
    const { container } = render(<PhoneShell />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hides the FAB when the user can view the list but not create', () => {
    // The route being enabled only proves a VIEW grant. Creating needs the same
    // edit permission the desktop create button checks, so a view-only user
    // must not get a create flow just by using a phone viewport.
    setViewport(true);
    mockUsePathname.mockReturnValue('/appointments');
    setOrg({ permissions: [PERMISSIONS.APPOINTMENTS_VIEW_ANY] });
    render(<PhoneShell />);

    expect(screen.queryByRole('button', { name: 'New appointment' })).not.toBeInTheDocument();
  });

  it('shows the FAB for a user who can only edit their own appointments', () => {
    setViewport(true);
    mockUsePathname.mockReturnValue('/appointments');
    setOrg({
      permissions: [PERMISSIONS.APPOINTMENTS_VIEW_ANY, PERMISSIONS.APPOINTMENTS_EDIT_OWN],
    });
    render(<PhoneShell />);

    expect(screen.getByRole('button', { name: 'New appointment' })).toBeInTheDocument();
  });

  it('renders the phone header, tab bar and FAB on a phone viewport', () => {
    setViewport(true);
    mockUsePathname.mockReturnValue('/appointments');
    render(<PhoneShell />);

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch organization' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Schedule/ })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: 'New appointment' })).toBeInTheDocument();
  });

  it('dispatches the primary-action event when the FAB is tapped', () => {
    setViewport(true);
    mockUsePathname.mockReturnValue('/appointments');
    const handler = jest.fn();
    globalThis.window.addEventListener(PHONE_PRIMARY_ACTION_EVENT, handler);

    render(<PhoneShell />);
    fireEvent.click(screen.getByRole('button', { name: 'New appointment' }));

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ key: 'appointment', href: '/appointments' });
    globalThis.window.removeEventListener(PHONE_PRIMARY_ACTION_EVENT, handler);
  });

  it('shows no FAB on pages without a creation action', () => {
    setViewport(true);
    mockUsePathname.mockReturnValue('/dashboard');
    render(<PhoneShell />);
    expect(screen.queryByRole('button', { name: /^New / })).not.toBeInTheDocument();
  });

  it('hides the FAB when the creation route is gated by verification', () => {
    setViewport(true);
    mockUsePathname.mockReturnValue('/appointments');
    setOrg({ verified: false });
    render(<PhoneShell />);
    expect(screen.queryByRole('button', { name: 'New appointment' })).not.toBeInTheDocument();
  });

  it('renders the Chat unread badge from the shell store', () => {
    setViewport(true);
    act(() => usePhoneShellStore.getState().setChatUnread(4));
    render(<PhoneShell />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('marks the More tab active while on a secondary-area route', () => {
    setViewport(true);
    mockUsePathname.mockReturnValue('/tasks');
    render(<PhoneShell />);
    expect(screen.getByRole('button', { name: /More/ })).toHaveClass('yc-phone-tab-active');
  });

  it('opens the More sheet and navigates from a secondary area', () => {
    setViewport(true);
    render(<PhoneShell />);

    const moreTab = screen.getByRole('button', { name: /More/ });
    expect(moreTab).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(moreTab);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(moreTab).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: /Finance/ }));
    expect(mockPush).toHaveBeenCalledWith('/finance');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the More sheet when the route changes', () => {
    setViewport(true);
    const view = render(<PhoneShell />);

    fireEvent.click(screen.getByRole('button', { name: /More/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    mockUsePathname.mockReturnValue('/companions');
    view.rerender(<PhoneShell />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /*
   * The portal was served the PIMS tab bar: Home/Schedule/Patients/Chat all
   * point at clinic routes, so a developer on a phone got a business menu and
   * could reach API keys or plugins only through the More sheet. The desktop
   * sidebar has always swapped appRoutes for devRoutes on this prefix.
   */
  it('serves the developer tab bar inside the portal, not the clinic one', () => {
    setViewport(true);
    setOrg();
    mockUsePathname.mockReturnValue('/developers/home');

    render(<PhoneShell />);

    expect(screen.getByRole('button', { name: /Plugins/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Docs/ })).toBeInTheDocument();
    // Home is the active tab on /developers/home, so the bar is tracking the
    // portal's own routes rather than a clinic prefix.
    expect(screen.getByRole('button', { name: /Home/ })).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('button', { name: /API Keys/ }));
    expect(mockPush).toHaveBeenCalledWith('/developers/api-keys');

    // The clinic destinations are gone.
    expect(screen.queryByRole('button', { name: /Schedule/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Chat/ })).not.toBeInTheDocument();
  });

  it('keeps the clinic tab bar outside the portal', () => {
    setViewport(true);
    setOrg();
    mockUsePathname.mockReturnValue('/appointments');

    render(<PhoneShell />);

    expect(screen.getByRole('button', { name: /Schedule/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /API Keys/ })).not.toBeInTheDocument();
  });

  // The org chip named a clinic the portal has nothing to do with, and tapping
  // it navigated out to /organizations.
  it('drops the org switcher from the portal header', () => {
    setViewport(true);
    setOrg();
    mockUsePathname.mockReturnValue('/developers/home');

    render(<PhoneShell />);

    expect(screen.queryByRole('button', { name: 'Switch organization' })).not.toBeInTheDocument();
  });
});
