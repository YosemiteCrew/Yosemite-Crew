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

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} priority={props.priority ? 'true' : 'false'} />,
}));

// Mock the overview stats hook
jest.mock('../../../../features/overview/hooks/useOverviewStats', () => ({
  useOverviewStats: jest.fn(),
}));

// Mock the auth store
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

// Mock the routing helper
jest.mock('@/app/lib/defaultOpenScreen', () => ({
  resolveDefaultOpenScreenRoute: jest.fn(),
}));

// Mock the custom UI components to keep tests focused
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
  default: ({ isLoading }: { isLoading: boolean }) => (
    <div data-testid="community-stats-component" data-loading={isLoading} />
  ),
}));

// ==========================================
// 2. TEST SUITE
// ==========================================

describe('OverviewPage Component', () => {
  const mockCombinedChart = [{ month: 'Jan', Stars: 10 }];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default hook implementations
    (useOverviewStats as jest.Mock).mockReturnValue({
      combinedChart: mockCombinedChart,
      isLoading: false,
    });
  });

  it('1. renders all static content, images, and child components correctly', () => {
    // Set logged out state for initial render check
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: null, role: null });

    render(<OverviewPage />);

    // Assert main text blocks exist
    expect(screen.getByRole('heading', { name: 'Building in Public' })).toBeInTheDocument();
    expect(screen.getByText(/Most companies keep their numbers private/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'When numbers are public, you see what’s working' })
    ).toBeInTheDocument();

    // Assert image renders with correct src
    const image = screen.getByAltText('Veterinarians working together');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute(
      'src',
      'https://d2il6osz49gpup.cloudfront.net/statsPage/statLanding.png'
    );

    // Assert child components render
    expect(screen.getByTestId('community-stats-component')).toBeInTheDocument();
    expect(screen.getByTestId('footer-component')).toBeInTheDocument();
  });

  it('2. CTA Button -> Unauthenticated User (Branch 1)', () => {
    // Mock user as NOT logged in
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: null, role: null });

    render(<OverviewPage />);

    const ctaBtn = screen.getByTestId('primary-btn');

    // Asserts the fallback signup route and capitalized "App"
    expect(ctaBtn).toHaveAttribute('href', '/signup');
    expect(ctaBtn).toHaveTextContent('Go to App');
  });

  it('3. CTA Button -> Authenticated Developer (Branch 2)', () => {
    // Mock user as logged in with 'developer' role
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: 'user-123' },
      role: 'developer',
    });

    render(<OverviewPage />);

    const ctaBtn = screen.getByTestId('primary-btn');

    // Asserts developer specific route and lowercase "app"
    expect(ctaBtn).toHaveAttribute('href', '/developers/home');
    expect(ctaBtn).toHaveTextContent('Go to app');
  });

  it('4. CTA Button -> Authenticated General User / Vet (Branch 3)', () => {
    // Mock user as logged in with standard 'vet' role
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: 'user-456' },
      role: 'vet',
    });

    // Mock the utility function to return a specific dashboard route
    (resolveDefaultOpenScreenRoute as jest.Mock).mockReturnValue('/vet/dashboard');

    render(<OverviewPage />);

    const ctaBtn = screen.getByTestId('primary-btn');

    // Asserts default screen resolver is called and returns correct link
    expect(resolveDefaultOpenScreenRoute).toHaveBeenCalledWith('vet');
    expect(ctaBtn).toHaveAttribute('href', '/vet/dashboard');
    expect(ctaBtn).toHaveTextContent('Go to app');
  });
});
