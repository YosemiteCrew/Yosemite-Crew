import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Import the component being tested
import OverviewPage from '../../../../features/overview/pages/OverviewPage';

// Import hooks and utilities that need to be mocked
import { useOverviewStats } from '../../../../features/overview/hooks/useOverviewStats';
import { useAuthStore } from '@/app/stores/authStore';
import { resolveDefaultOpenScreenRoute } from '@/app/lib/defaultOpenScreen';

// ==========================================
// 1. MOCK SETUP
// ==========================================

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => (
    <span
      data-testid="mock-next-image"
      data-alt={props.alt}
      data-priority={props.priority ? 'true' : 'false'}
    />
  ),
}));

jest.mock('../../../../features/overview/hooks/useOverviewStats', () => ({
  useOverviewStats: jest.fn(),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/app/lib/defaultOpenScreen', () => ({
  resolveDefaultOpenScreenRoute: jest.fn(),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, href }: any) => (
    <a data-testid="primary-btn" href={href}>
      {text}
    </a>
  ),
}));

jest.mock('@/app/ui/widgets/Footer/Footer', () => ({
  __esModule: true,
  default: () => <footer data-testid="footer-component" />,
}));

jest.mock('../../../../features/overview/components/CommunityStats', () => ({
  __esModule: true,
  default: () => <div data-testid="community-stats-component" />,
}));

// ==========================================
// 2. TEST SUITE
// ==========================================

describe('OverviewPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. formats stats correctly and renders static content (Logged Out State)', () => {
    // Mock user as NOT logged in
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: null, role: null });

    // Mock data to test BOTH branches of formatStat (>= 1000 and < 1000)
    (useOverviewStats as jest.Mock).mockReturnValue({
      trafficChart: [],
      starsChart: [],
      totalSelfHosters: 1600,
      totalStars: 2100, // Should hit the >= 1000 branch and return "2.1k"
      totalForks: 64,
      totalContributors: 15,
      totalDiscordMembers: 169,
      isLoading: false,
    });

    render(<OverviewPage />);

    // Assert main text blocks exist
    expect(screen.getByRole('heading', { name: 'Building in Public' })).toBeInTheDocument();

    // Assert formatted stats exist
    expect(screen.getByText('1.6k')).toBeInTheDocument();
    expect(screen.getByText('2.1k')).toBeInTheDocument();
    expect(screen.getByText('169')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Self Hosters')).toBeInTheDocument();
    expect(screen.getByText('Contributors')).toBeInTheDocument();
    expect(screen.getByText('Discord Members')).toBeInTheDocument();
    expect(screen.getByText('Repo Stars')).toBeInTheDocument();

    // Assert image renders
    const image = screen.getByTestId('mock-next-image');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('data-alt', 'Veterinarians working together');

    // Assert child components render
    expect(screen.getByTestId('community-stats-component')).toBeInTheDocument();
    expect(screen.getByTestId('footer-component')).toBeInTheDocument();

    // Assert CTA Button (Branch 1: No User)
    const ctaBtn = screen.getByTestId('primary-btn');
    expect(ctaBtn).toHaveAttribute('href', '/signup');
    expect(ctaBtn).toHaveTextContent('Go to App');
  });

  it('2. verifies loading state correctly masks the stats with dashes', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: null, role: null });

    // Mock isLoading as true
    (useOverviewStats as jest.Mock).mockReturnValue({
      trafficChart: [],
      starsChart: [],
      totalSelfHosters: 1600,
      totalStars: 2100,
      totalForks: 64,
      totalContributors: 15,
      totalDiscordMembers: 169,
      isLoading: true,
    });

    render(<OverviewPage />);

    // There are now 4 hero stats, so loading shows 4 dashes
    const dashes = screen.getAllByText('-');
    expect(dashes).toHaveLength(4);

    // Ensure the raw numbers are NOT rendered
    expect(screen.queryByText('1.6k')).not.toBeInTheDocument();
    expect(screen.queryByText('2.1k')).not.toBeInTheDocument();
    expect(screen.queryByText('169')).not.toBeInTheDocument();
  });

  it('3. dynamic CTA Button routes correctly for Authenticated Developer', () => {
    // Mock user as logged in with 'developer' role
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: 'user-123' },
      role: 'developer',
    });

    (useOverviewStats as jest.Mock).mockReturnValue({
      trafficChart: [],
      starsChart: [],
      totalSelfHosters: 0,
      totalStars: 0,
      totalForks: 0,
      totalContributors: 0,
      totalDiscordMembers: 169,
      isLoading: false,
    });

    render(<OverviewPage />);

    const ctaBtn = screen.getByTestId('primary-btn');

    // Asserts developer specific route and lowercase "app" (Branch 2)
    expect(ctaBtn).toHaveAttribute('href', '/developers/home');
    expect(ctaBtn).toHaveTextContent('Go to app');
  });

  it('4. dynamic CTA Button routes correctly for Authenticated General User', () => {
    // Mock user as logged in with standard 'vet' role
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: 'user-456' },
      role: 'vet',
    });

    // Mock the utility function to return a specific dashboard route
    (resolveDefaultOpenScreenRoute as jest.Mock).mockReturnValue('/vet/dashboard');

    (useOverviewStats as jest.Mock).mockReturnValue({
      trafficChart: [],
      starsChart: [],
      totalSelfHosters: 0,
      totalStars: 0,
      totalForks: 0,
      totalContributors: 0,
      totalDiscordMembers: 169,
      isLoading: false,
    });

    render(<OverviewPage />);

    const ctaBtn = screen.getByTestId('primary-btn');

    // Asserts default screen resolver is called and returns correct link (Branch 3)
    expect(resolveDefaultOpenScreenRoute).toHaveBeenCalledWith('vet');
    expect(ctaBtn).toHaveAttribute('href', '/vet/dashboard');
    expect(ctaBtn).toHaveTextContent('Go to app');
  });
});
