import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import UserHeader from '@/app/ui/layout/Header/UserHeader/UserHeader';
import { usePathname, useRouter } from 'next/navigation';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAuthStore } from '@/app/stores/authStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import type { Organisation } from '@yosemite-crew/types';
import { resolveOrgScopedRedirect } from '@/app/lib/postAuthRedirect';
import { useFullscreenLoaderStore } from '@/app/stores/fullscreenLoaderStore';

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

    // Notification Icon (design uses the outline bell glyph)
    expect(screen.getByTestId('IoNotificationsOutline')).toBeInTheDocument();

    // The account control is the header's own nav affordance
    expect(screen.getByRole('button', { name: /account/i })).toBeInTheDocument();
  });

  it('renders no hamburger menu at any width', () => {
    // Navigation is the sidebar rail (>= 768px) or the PhoneShell tab bar (< 768px);
    // the signed-in header never owns a hamburger drawer.
    (usePathname as jest.Mock).mockReturnValue('/dashboard');

    render(<UserHeader />);

    expect(screen.queryByLabelText('Open menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
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

  it('renders a blue-soft monogram chip when the organization has no logo', () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    useOrgStore
      .getState()
      .setOrgs([{ _id: 'org-1', name: 'Alpha Vet', type: 'HOSPITAL' } as Organisation], {
        keepPrimaryIfPresent: false,
      });

    const { container } = render(<UserHeader />);

    const chip = container.querySelector('.yc-header-org-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('A');
    expect(container.querySelector('.yc-header-org-trigger .yc-header-avatar')).toBeNull();
  });

  it('falls back to "O" on the monogram chip when the organization name is blank', () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    useOrgStore
      .getState()
      .setOrgs([{ _id: 'org-1', name: '  ', type: 'HOSPITAL' } as Organisation], {
        keepPrimaryIfPresent: false,
      });

    const { container } = render(<UserHeader />);

    expect(container.querySelector('.yc-header-org-chip')).toHaveTextContent('O');
  });

  it('renders the organization logo when one is set', () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    useOrgStore.getState().setOrgs(
      [
        {
          _id: 'org-1',
          name: 'Alpha Vet',
          type: 'HOSPITAL',
          imageURL: 'https://example.com/org.png',
        } as Organisation,
      ],
      { keepPrimaryIfPresent: false }
    );

    const { container } = render(<UserHeader />);

    expect(container.querySelector('.yc-header-org-chip')).toBeNull();
    expect(screen.getAllByTestId('next-image')[0]).toHaveAttribute(
      'data-src',
      'https://example.com/org.png'
    );
  });

  // --- 3. Sign Out Logic ---

  it('handles Sign out correctly for App users', async () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /account/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/signin');
    });
  });

  it('handles Sign out correctly for Developer users (redirects to dev signin)', async () => {
    (usePathname as jest.Mock).mockReturnValue('/developers/home');
    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /account/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/developers/signin');
    });
  });

  it('handles Sign out errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSignOut.mockRejectedValueOnce(new Error('Sign out failed'));

    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /account/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      // Should log error but not crash
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ Signout error:', expect.any(Error));
    });

    consoleSpy.mockRestore();
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

  describe('org switch fullscreen loader', () => {
    const seedTwoOrgs = () => {
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
    };

    const switchToBetaVet = async () => {
      const orgTrigger = screen
        .getAllByRole('button', { name: /organization/i })
        .find((element) => !element.className.includes('yc-mobile-org-trigger'));

      await act(async () => {
        fireEvent.click(orgTrigger!);
      });
      await act(async () => {
        fireEvent.click(screen.getAllByRole('menuitem', { name: 'Beta Vet' })[0]);
      });
    };

    afterEach(() => {
      useFullscreenLoaderStore.getState().clear();
      globalThis.window.history.pushState({}, '', '/');
    });

    it('releases the loader when the org resolves to the route already shown', async () => {
      globalThis.window.history.pushState({}, '', '/dashboard');
      (usePathname as jest.Mock).mockReturnValue('/dashboard');
      (resolveOrgScopedRedirect as jest.Mock).mockResolvedValue('/dashboard');
      seedTwoOrgs();
      render(<UserHeader />);

      await switchToBetaVet();

      // RouteLoaderOverlay only clears this on a pathname/query change, and
      // pushing the current route fires neither.
      await waitFor(() => {
        expect(useFullscreenLoaderStore.getState().activeSources['org-switch']).toBeUndefined();
      });
    });

    it('leaves the loader up when the org switch actually navigates away', async () => {
      globalThis.window.history.pushState({}, '', '/dashboard');
      (usePathname as jest.Mock).mockReturnValue('/dashboard');
      (resolveOrgScopedRedirect as jest.Mock).mockResolvedValue('/team-onboarding?orgId=org-2');
      seedTwoOrgs();
      render(<UserHeader />);

      await switchToBetaVet();

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/team-onboarding?orgId=org-2');
      });
      expect(useFullscreenLoaderStore.getState().activeSources['org-switch']).toBe(true);
    });

    it('releases the loader when resolving the next route fails', async () => {
      globalThis.window.history.pushState({}, '', '/dashboard');
      (usePathname as jest.Mock).mockReturnValue('/dashboard');
      (resolveOrgScopedRedirect as jest.Mock).mockRejectedValue(new Error('resolve failed'));
      seedTwoOrgs();
      render(<UserHeader />);

      await switchToBetaVet();

      await waitFor(() => {
        expect(useFullscreenLoaderStore.getState().activeSources['org-switch']).toBeUndefined();
      });
    });
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

  it.each([
    ['Settings', /settings/i],
    ['MSD Veterinary Manual', /MSD Veterinary Manual/i],
    ['Guides', /guides/i],
  ])('closes the account dropdown when the %s link is clicked', async (_label, name) => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    seedVerifiedOrgs();

    render(<UserHeader />);

    const profileTrigger = screen.getByRole('button', { name: /account/i });
    await act(async () => {
      fireEvent.click(profileTrigger);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name }));
    });

    await waitFor(() => {
      expect(profileTrigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('closes the desktop organization dropdown from the "View all organizations" link', async () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    seedVerifiedOrgs();

    render(<UserHeader />);

    const trigger = getDesktopOrgTrigger();
    await act(async () => {
      fireEvent.click(trigger!);
    });

    const viewAll = screen.getByRole('menuitem', { name: 'View all organizations' });
    expect(viewAll).toHaveAttribute('href', '/organizations');

    await act(async () => {
      fireEvent.click(viewAll);
    });

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('falls back to the membership roleCode when no roleDisplay is set', async () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    useOrgStore
      .getState()
      .setOrgs(
        [
          { _id: 'org-1', name: 'Alpha Vet', type: 'HOSPITAL', isVerified: true } as Organisation,
          { _id: 'org-2', name: 'Beta Vet', type: 'HOSPITAL', isVerified: true } as Organisation,
        ],
        { keepPrimaryIfPresent: false }
      );
    // roleCode only exercises the `roleDisplay ?? roleCode` fallback.
    useOrgStore
      .getState()
      .setUserOrgMappings([
        { organizationReference: 'org-1', roleCode: 'vet' } as any,
        { organizationReference: 'org-2', roleCode: 'vet' } as any,
      ]);

    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(getDesktopOrgTrigger()!);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Beta Vet' }));
    });

    await waitFor(() => {
      expect(resolveOrgScopedRedirect).toHaveBeenCalledWith({
        orgId: 'org-2',
        fallbackRole: 'vet',
      });
    });
  });

  it('falls back to the org name when an organization has no id', async () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    useOrgStore
      .getState()
      .setOrgs(
        [
          { _id: 'org-1', name: 'Alpha Vet', type: 'HOSPITAL', isVerified: true } as Organisation,
          { name: 'Nameless Vet', type: 'HOSPITAL', isVerified: true } as Organisation,
        ],
        { keepPrimaryIfPresent: false }
      );
    useOrgStore
      .getState()
      .setUserOrgMappings([{ organizationReference: 'org-1', roleDisplay: 'OWNER' } as any]);

    render(<UserHeader />);

    await act(async () => {
      fireEvent.click(getDesktopOrgTrigger()!);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Nameless Vet' }));
    });

    await waitFor(() => {
      expect(resolveOrgScopedRedirect).toHaveBeenCalledWith({
        orgId: 'Nameless Vet',
        fallbackRole: undefined,
      });
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

  it('resets open menus when the pathname changes', async () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');

    const { rerender } = render(<UserHeader />);

    const profileTrigger = screen.getByRole('button', { name: /account/i });
    await act(async () => {
      fireEvent.click(profileTrigger);
    });
    expect(profileTrigger).toHaveAttribute('aria-expanded', 'true');

    (usePathname as jest.Mock).mockReturnValue('/tasks');
    await act(async () => {
      rerender(<UserHeader />);
    });

    expect(screen.getByRole('button', { name: /account/i })).toHaveAttribute(
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
