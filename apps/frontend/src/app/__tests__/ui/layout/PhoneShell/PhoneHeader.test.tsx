import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PhoneHeader from '@/app/ui/layout/PhoneShell/PhoneHeader';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import { useUniversalSearchStore } from '@/app/stores/universalSearchStore';
import { startRouteLoader } from '@/app/lib/routeLoader';

const mockPush = jest.fn();
let mockPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

jest.mock('next/image', () => {
  const MockImage = ({ alt }: any) => <span data-testid="next-image">{alt}</span>;
  MockImage.displayName = 'MockNextImage';
  return { __esModule: true, default: MockImage };
});

jest.mock('@/app/hooks/useOrgSelectors', () => ({ usePrimaryOrg: jest.fn() }));
jest.mock('@/app/lib/routeLoader', () => ({
  startRouteLoader: jest.fn(),
  stopRouteLoader: jest.fn(),
}));

const mockUsePrimaryOrg = usePrimaryOrg as unknown as jest.Mock;

describe('PhoneHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
    useUniversalSearchStore.getState().close();
  });

  it('renders the org switcher with the org name and navigates to the org picker', () => {
    mockUsePrimaryOrg.mockReturnValue({
      _id: 'org-1',
      name: 'Alpenblick Animal Clinic',
      imageURL: null,
      isVerified: true,
    });

    render(<PhoneHeader />);
    const orgButton = screen.getByRole('button', { name: 'Switch organization' });
    expect(screen.getByText('Alpenblick Animal Clinic')).toBeInTheDocument();

    fireEvent.click(orgButton);
    expect(startRouteLoader).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/organizations');
  });

  it('opens the universal search palette from the search icon-button', () => {
    mockUsePrimaryOrg.mockReturnValue({ _id: 'org-1', name: 'Clinic', imageURL: null });
    render(<PhoneHeader />);

    expect(useUniversalSearchStore.getState().isOpen).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(useUniversalSearchStore.getState().isOpen).toBe(true);
  });

  it('renders the notifications bell', () => {
    mockUsePrimaryOrg.mockReturnValue({ _id: 'org-1', name: 'Clinic', imageURL: null });
    render(<PhoneHeader />);
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('falls back to the brand logo when no org is loaded', () => {
    mockUsePrimaryOrg.mockReturnValue(null);
    render(<PhoneHeader />);
    expect(screen.queryByRole('button', { name: 'Switch organization' })).not.toBeInTheDocument();
    expect(screen.getByText('Yosemite Crew')).toBeInTheDocument();
    // Search + bell remain available.
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  /*
   * The portal is not org-scoped, so the chip named a clinic the page has
   * nothing to do with, and tapping it navigated out of the portal entirely.
   * Desktop has always hidden it here; the phone header was the shell that
   * still showed it.
   */
  it.each([['/developers/home'], ['/developers/api-keys'], ['/developers/settings']])(
    'hides the org switcher inside the developer portal (%s)',
    (pathname) => {
      mockPathname = pathname;
      mockUsePrimaryOrg.mockReturnValue({
        _id: 'org-1',
        name: 'Groomer sample shop',
        imageURL: null,
        isVerified: true,
      });

      render(<PhoneHeader />);

      expect(screen.queryByRole('button', { name: 'Switch organization' })).not.toBeInTheDocument();
      expect(screen.queryByText('Groomer sample shop')).not.toBeInTheDocument();
      // Falls back to the brand mark, which is what an account with no org sees.
      expect(screen.getByText('Yosemite Crew')).toBeInTheDocument();
    }
  );

  it('still shows the org switcher outside the portal for an org member', () => {
    mockPathname = '/appointments';
    mockUsePrimaryOrg.mockReturnValue({
      _id: 'org-1',
      name: 'Groomer sample shop',
      imageURL: null,
      isVerified: true,
    });

    render(<PhoneHeader />);

    expect(screen.getByRole('button', { name: 'Switch organization' })).toBeInTheDocument();
  });
});
