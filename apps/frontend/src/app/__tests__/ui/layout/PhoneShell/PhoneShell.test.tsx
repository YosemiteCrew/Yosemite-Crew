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
      membershipsByOrgId: { 'org-1': { effectivePermissions: permissions } },
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
});
