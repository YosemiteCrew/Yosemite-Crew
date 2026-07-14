import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import UserHeader from '@/app/ui/layout/Header/UserHeader/UserHeader';
import { usePathname, useRouter } from 'next/navigation';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAuthStore } from '@/app/stores/authStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import type { Organisation } from '@yosemite-crew/types';
import { resolveOrgScopedRedirect } from '@/app/lib/postAuthRedirect';

// --- Mocks ---

// Mock Next.js hooks
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

// Mock Auth Hook
const mockSignOut = jest.fn();
jest.mock('@/app/hooks/useAuth', () => ({
  useSignOut: jest.fn(() => ({
    signOut: mockSignOut,
  })),
}));

// Mock Next/Link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} data-testid="next-link" {...rest}>
      {children}
    </a>
  ),
}));

// Mock Next/Image
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <span data-testid="next-image" data-src={src} data-alt={alt} />
  ),
}));

// Mock Icons
jest.mock(
  'react-icons/io5',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);
jest.mock('@/app/hooks/useMerckIntegration', () => ({
  useResolvedMerckIntegrationForPrimaryOrg: jest.fn(() => ({ isEnabled: true })),
}));

jest.mock('@/app/lib/postAuthRedirect', () => ({
  resolveOrgScopedRedirect: jest.fn(),
}));

describe('UserHeader Component', () => {
  const mockPush = jest.fn();
  const mockReplace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useOrgStore.getState().clearOrgs();
    useAuthStore.setState({ attributes: null });
    useUserProfileStore.setState({ profilesByOrgId: {} });
    (resolveOrgScopedRedirect as jest.Mock).mockResolvedValue('/dashboard');
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    });
  });

  const seedVerifiedOrgs = () => {
    useOrgStore
      .getState()
      .setOrgs(
        [
          { _id: 'org-1', name: 'Alpha Vet', type: 'HOSPITAL', isVerified: true } as Organisation,
          { _id: 'org-2', name: 'Beta Vet', type: 'HOSPITAL', isVerified: true } as Organisation,
        ],
        { keepPrimaryIfPresent: false }
      );
    useOrgStore
      .getState()
      .setUserOrgMappings([
        { organizationReference: 'org-1', roleDisplay: 'OWNER' } as any,
        { organizationReference: 'org-2', roleDisplay: 'OWNER' } as any,
      ]);
  };

  const getDesktopOrgTrigger = () =>
    screen
      .getAllByRole('button', { name: /organization/i })
      .find((element) => element.className.includes('yc-header-org-trigger'));

  // --- 1. Initial Render (App Routes) ---

  it('renders the header correctly for normal app routes', () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');

    render(<UserHeader />);

    // Logo check
    expect(screen.getByTestId('next-link')).toHaveAttribute('href', '/dashboard');

    // Notification Icon
    expect(screen.getByTestId('IoNotifications')).toBeInTheDocument();

    // Menu Toggle Button (Hamburger)
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
  });

  // --- 2. Menu Interaction & Navigation ---

  it('opens the menu and displays App routes', async () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    render(<UserHeader />);

    const toggleBtn = screen.getByLabelText('Open menu');

    // Open menu
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    // Check App Routes are visible
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();

    // Verify toggle button state changes
    expect(screen.getByLabelText('Close menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-controls',
      'user-mobile-menu'
    );
  });

  it('opens the menu and displays Developer routes when path starts with /developers', async () => {
    (usePathname as jest.Mock).mockReturnValue('/developers/home');
    render(<UserHeader />);

    const toggleBtn = screen.getByLabelText('Open menu');

    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    // Check Developer Routes are visible
    expect(screen.getByText('API Keys')).toBeInTheDocument();
    expect(screen.getByText('Website - Builder')).toBeInTheDocument();
    expect(screen.getByText('Documentation')).toBeInTheDocument();

    // Ensure standard app routes are NOT visible (e.g. "Finance")
    expect(screen.queryByText('Finance')).not.toBeInTheDocument();
  });

  it('uses the developer home link for the authenticated logo on developer routes', () => {
    (usePathname as jest.Mock).mockReturnValue('/developers/home');

    render(<UserHeader />);

    expect(screen.getByTestId('next-link')).toHaveAttribute('href', '/developers/home');
  });

  it('updates the companions search placeholder with organization terminology after mount', async () => {
    (usePathname as jest.Mock).mockReturnValue('/companions');
    const hospitalOrg = {
      _id: 'hospital-org',
      name: 'Hospital Org',
      type: 'HOSPITAL',
    } as Organisation;

    useOrgStore.getState().setOrgs([hospitalOrg]);

    render(<UserHeader />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search patients')).toBeInTheDocument();
    });
  });

  // --- 3. Sign Out Logic ---

  it('handles Sign out correctly for App users', async () => {
    jest.useFakeTimers();
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    render(<UserHeader />);

    // Open Menu
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open menu'));
    });

    const signOutBtn = screen.getByText('Sign out');

    // Click Sign Out
    await act(async () => {
      fireEvent.click(signOutBtn);
    });

    // Fast-forward delay
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    // Wait for async sign out logic
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/signin');
    });

    jest.useRealTimers();
  });

  it('handles Sign out correctly for Developer users (redirects to dev signin)', async () => {
    jest.useFakeTimers();
    (usePathname as jest.Mock).mockReturnValue('/developers/home');
    render(<UserHeader />);

    // Open Menu
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open menu'));
    });

    const signOutBtn = screen.getByText('Sign out');

    await act(async () => {
      fireEvent.click(signOutBtn);
    });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/developers/signin');
    });

    jest.useRealTimers();
  });

  it('handles Sign out errors gracefully', async () => {
    jest.useFakeTimers();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSignOut.mockRejectedValueOnce(new Error('Sign out failed'));

    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open menu'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Sign out'));
    });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      // Should log error but not crash
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ Cognito signout error:', expect.any(Error));
    });

    consoleSpy.mockRestore();
    jest.useRealTimers();
  });

  it('wires desktop account controls with expanded and controlled menu semantics', async () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    render(<UserHeader />);

    const profileTrigger = screen.getByRole('button', { name: /account/i });
    expect(profileTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(profileTrigger).toHaveAttribute('aria-controls', 'user-header-profile-menu');

    await act(async () => {
      fireEvent.click(profileTrigger);
    });

    expect(screen.getByRole('menu')).toHaveAttribute('id', 'user-header-profile-menu');
    expect(profileTrigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes the account menu when Escape is pressed', async () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /account/i }));
    });

    const accountMenu = screen.getByRole('menu');
    fireEvent.keyDown(accountMenu, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('switches organizations from the mobile menu and closes the drawer', async () => {
    jest.useFakeTimers();
    (usePathname as jest.Mock).mockReturnValue('/dashboard');

    useOrgStore
      .getState()
      .setOrgs(
        [
          { _id: 'org-1', name: 'Alpha Vet', type: 'HOSPITAL' } as Organisation,
          { _id: 'org-2', name: 'Beta Vet', type: 'HOSPITAL' } as Organisation,
        ],
        { keepPrimaryIfPresent: false }
      );
    useOrgStore
      .getState()
      .setUserOrgMappings([
        { organizationReference: 'org-1', roleDisplay: 'OWNER' } as any,
        { organizationReference: 'org-2', roleDisplay: 'OWNER' } as any,
      ]);

    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    });

    const mobileNavigation = screen.getByRole('navigation', { name: 'Mobile navigation' });

    const mobileOrgTrigger = within(mobileNavigation)
      .getAllByRole('button', { name: /organization/i })
      .find((element) => element.className.includes('yc-mobile-org-trigger'));

    expect(mobileOrgTrigger).toBeDefined();

    await act(async () => {
      fireEvent.click(mobileOrgTrigger!);
    });

    await act(async () => {
      fireEvent.click(within(mobileNavigation).getAllByRole('menuitem', { name: 'Beta Vet' })[0]);
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(resolveOrgScopedRedirect).toHaveBeenCalledWith({
        orgId: 'org-2',
        fallbackRole: 'OWNER',
      });
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(
      within(mobileNavigation).queryByRole('menuitem', { name: 'Beta Vet' })
    ).not.toBeInTheDocument();

    jest.useRealTimers();
  });

  it('switches organizations from the desktop dropdown', async () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    seedVerifiedOrgs();

    render(<UserHeader />);

    const trigger = getDesktopOrgTrigger();
    expect(trigger).toBeDefined();

    await act(async () => {
      fireEvent.click(trigger!);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Beta Vet' }));
    });

    await waitFor(() => {
      expect(resolveOrgScopedRedirect).toHaveBeenCalledWith({
        orgId: 'org-2',
        fallbackRole: 'OWNER',
      });
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('hides the loader and skips navigation when the desktop org switch fails', async () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    (resolveOrgScopedRedirect as jest.Mock).mockRejectedValueOnce(new Error('redirect failed'));
    seedVerifiedOrgs();

    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(getDesktopOrgTrigger()!);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Beta Vet' }));
    });

    await waitFor(() => {
      expect(resolveOrgScopedRedirect).toHaveBeenCalled();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('closes the desktop organization dropdown on Escape', async () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    seedVerifiedOrgs();

    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(getDesktopOrgTrigger()!);
    });

    const orgMenu = screen.getByRole('menu');
    fireEvent.keyDown(orgMenu, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('closes the desktop organization dropdown when clicking outside', async () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    seedVerifiedOrgs();

    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(getDesktopOrgTrigger()!);
    });

    expect(screen.getByRole('menu')).toBeInTheDocument();

    await act(async () => {
      fireEvent.mouseDown(document.body);
    });

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('closes the account dropdown when clicking outside', async () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');

    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /account/i }));
    });

    expect(screen.getByRole('menu')).toBeInTheDocument();

    await act(async () => {
      fireEvent.mouseDown(document.body);
    });

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('recovers the fullscreen loader when the mobile org switch fails', async () => {
    jest.useFakeTimers();
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    (resolveOrgScopedRedirect as jest.Mock).mockRejectedValue(new Error('redirect failed'));
    seedVerifiedOrgs();

    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    });

    const mobileNavigation = screen.getByRole('navigation', { name: 'Mobile navigation' });
    const mobileOrgTrigger = within(mobileNavigation)
      .getAllByRole('button', { name: /organization/i })
      .find((element) => element.className.includes('yc-mobile-org-trigger'));

    await act(async () => {
      fireEvent.click(mobileOrgTrigger!);
    });

    await act(async () => {
      fireEvent.click(within(mobileNavigation).getAllByRole('menuitem', { name: 'Beta Vet' })[0]);
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolveOrgScopedRedirect).toHaveBeenCalledWith({
      orgId: 'org-2',
      fallbackRole: 'OWNER',
    });
    expect(mockPush).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('closes the mobile drawer from the "View all organizations" link', async () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    seedVerifiedOrgs();

    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    });

    const mobileNavigation = screen.getByRole('navigation', { name: 'Mobile navigation' });
    const mobileOrgTrigger = within(mobileNavigation)
      .getAllByRole('button', { name: /organization/i })
      .find((element) => element.className.includes('yc-mobile-org-trigger'));

    await act(async () => {
      fireEvent.click(mobileOrgTrigger!);
    });

    await act(async () => {
      fireEvent.click(
        within(mobileNavigation).getByRole('menuitem', { name: 'View all organizations' })
      );
    });

    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('navigates to an enabled route from the mobile menu after the transition delay', async () => {
    jest.useFakeTimers();
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    seedVerifiedOrgs();

    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open menu'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Appointments'));
    });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(mockPush).toHaveBeenCalledWith('/appointments');

    jest.useRealTimers();
  });

  it('does not navigate when a disabled route is clicked in the mobile menu', async () => {
    jest.useFakeTimers();
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    // Org present but unverified => verify-gated routes are disabled.
    useOrgStore
      .getState()
      .setOrgs(
        [{ _id: 'org-1', name: 'Alpha Vet', type: 'HOSPITAL', isVerified: false } as Organisation],
        {
          keepPrimaryIfPresent: false,
        }
      );

    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open menu'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Appointments'));
    });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(mockPush).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('closes the mobile drawer when Escape is pressed', async () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');

    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open menu'));
    });

    expect(screen.getByLabelText('Close menu')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
        'aria-expanded',
        'false'
      );
    });
  });

  it('resets open menus when the pathname changes', async () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');

    const { rerender } = render(<UserHeader />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open menu'));
    });
    expect(screen.getByLabelText('Close menu')).toBeInTheDocument();

    (usePathname as jest.Mock).mockReturnValue('/tasks');
    await act(async () => {
      rerender(<UserHeader />);
    });

    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('uses the developer settings href in the account dropdown on developer routes', async () => {
    (usePathname as jest.Mock).mockReturnValue('/developers/home');

    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /account/i }));
    });

    const settingsLink = screen.getByRole('menuitem', { name: /settings/i });
    expect(settingsLink).toHaveAttribute('href', '/developers/settings');
  });

  it('renders the signed-in display name and account role from the auth store', () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    useAuthStore.setState({ attributes: { given_name: 'Jane', family_name: 'Doe' } });
    useOrgStore
      .getState()
      .setOrgs(
        [{ _id: 'org-1', name: 'Alpha Vet', type: 'HOSPITAL', isVerified: true } as Organisation],
        {
          keepPrimaryIfPresent: false,
        }
      );
    // Membership with only a roleCode exercises the roleDisplay ?? roleCode fallback.
    useOrgStore
      .getState()
      .setUserOrgMappings([{ organizationReference: 'org-1', roleCode: 'vet' } as any]);
    useUserProfileStore.setState({
      profilesByOrgId: {
        'org-1': { personalDetails: { profilePictureUrl: 'https://example.com/me.png' } } as any,
      },
    });

    render(<UserHeader />);

    expect(screen.getByRole('button', { name: /Jane Doe/i })).toBeInTheDocument();
  });

  it('renders search placeholders that match the current route', () => {
    const cases: Array<{ path: string; placeholder?: string }> = [
      { path: '/appointments/idexx-workspace', placeholder: 'Search result / order' },
      { path: '/appointments', placeholder: 'Search appointments' },
      { path: '/inventory' },
      { path: '/integrations/idexx-workspace', placeholder: 'Search result / order' },
      { path: '/integrations' },
      { path: '/forms', placeholder: 'Search forms' },
      { path: '/tasks', placeholder: 'Search tasks' },
      { path: '/finance', placeholder: 'Search invoices' },
      { path: '/organization/specialities', placeholder: 'Search specialities' },
    ];

    for (const testCase of cases) {
      (usePathname as jest.Mock).mockReturnValue(testCase.path);
      const view = render(<UserHeader />);
      if (testCase.placeholder) {
        expect(screen.getByPlaceholderText(testCase.placeholder)).toBeInTheDocument();
      }
      view.unmount();
    }
  });
});
