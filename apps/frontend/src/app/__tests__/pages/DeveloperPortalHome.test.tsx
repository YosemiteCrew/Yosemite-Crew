import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

const useAuthStoreMock = jest.fn();

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: () => useAuthStoreMock(),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  __esModule: true,
  Primary: ({ text, href }: any) => (
    <a href={href} data-testid={`primary-${text}`}>
      {text}
    </a>
  ),
  Secondary: ({ text, href }: any) => (
    <a href={href} data-testid={`secondary-${text}`}>
      {text}
    </a>
  ),
}));

jest.mock('@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="dev-guard">{children}</div>,
}));

jest.mock('@iconify/react', () => ({
  __esModule: true,
  Icon: ({ icon }: any) => <span data-testid={`icon-${icon}`} />,
}));

const mockIsPhone = jest.fn(() => false);
jest.mock('@/app/ui/layout/PhoneShell/useIsPhone', () => ({
  __esModule: true,
  useIsPhone: () => mockIsPhone(),
  default: () => mockIsPhone(),
}));

jest.mock('@/app/features/developers/pages/DeveloperPortalHome/PhoneDevHome', () => ({
  __esModule: true,
  default: ({ displayName, recentActivity }: any) => (
    <div data-testid="phone-dev-home" data-activity-count={recentActivity?.length}>
      {displayName}
    </div>
  ),
}));

import DeveloperPortalHome from '@/app/features/developers/pages/DeveloperPortalHome/DeveloperPortalHome';

const createState = (attributes: Record<string, string>) => ({
  attributes,
});

describe('DeveloperPortalHome page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPhone.mockReturnValue(false);
  });

  test('renders developer home content when authenticated', () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({
        given_name: 'Ada',
        family_name: 'Lovelace',
      }),
    });

    render(<DeveloperPortalHome />);

    expect(screen.getByTestId('dev-guard')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Welcome back, Ada Lovelace/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId('primary-View docs')).toHaveAttribute(
      'href',
      '/developers/documentation'
    );
    expect(screen.getByTestId('secondary-Contact support')).toHaveAttribute('href', '/contact-us');
  });

  test('shows fallback name when no user name is available', () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({}),
    });

    render(<DeveloperPortalHome />);

    expect(screen.getByRole('heading', { name: /Welcome back, Developer/i })).toBeInTheDocument();
  });

  test('uses email as fallback when name is not provided', () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({
        email: 'test@example.com',
      }),
    });

    render(<DeveloperPortalHome />);

    expect(
      screen.getByRole('heading', { name: /Welcome back, test@example.com/i })
    ).toBeInTheDocument();
  });

  test('has no axe violations', async () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    const { container } = render(<DeveloperPortalHome />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('the Welcome back greeting is the page h1 and no Developer Home heading remains', () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    render(<DeveloperPortalHome />);
    expect(
      screen.getByRole('heading', { level: 1, name: /Welcome back, Ada Lovelace/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Developer Home/i })).not.toBeInTheDocument();
  });

  test('quick status card shows the Next step and Portal access rows', () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    render(<DeveloperPortalHome />);
    expect(screen.getByText('Quick status')).toBeInTheDocument();
    expect(screen.getByText('Portal access')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Browse documentation →')).toBeInTheDocument();
  });

  test('renders the FHIR-native hero card with a Create an API key action', () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    render(<DeveloperPortalHome />);
    expect(screen.getByText('FHIR-NATIVE API')).toBeInTheDocument();
    expect(
      screen.getByText(/One API for appointments, patients, and records/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('secondary-Create an API key')).toHaveAttribute(
      'href',
      '/developers/api-keys'
    );
  });

  test('quick status card shows the Requests 24h metric row', () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    render(<DeveloperPortalHome />);
    expect(screen.getByText('Requests · 24h')).toBeInTheDocument();
    expect(screen.getByText('4,218')).toBeInTheDocument();
  });

  test('renders all four quick links including Quickstart and GitHub', () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    render(<DeveloperPortalHome />);
    expect(screen.getByText(/Quickstart · first request in 5 minutes/i)).toBeInTheDocument();
    expect(screen.getByText('Partner with Yosemite Crew')).toBeInTheDocument();
    expect(screen.getByText('Security & compliance')).toBeInTheDocument();
    const github = screen.getByText('github.com/YosemiteCrew').closest('a');
    expect(github).toHaveAttribute('href', 'https://github.com/YosemiteCrew');
    expect(github).toHaveAttribute('target', '_blank');
  });

  test('renders the Your plugin card in review', () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    render(<DeveloperPortalHome />);
    expect(screen.getByRole('heading', { name: 'Your plugin' })).toBeInTheDocument();
    expect(screen.getByText('Anesthesia monitor sync')).toBeInTheDocument();
    expect(screen.getByText('v0.4.1 · submitted 04 Jul')).toBeInTheDocument();
    expect(screen.getByText('Review status').closest('a')).toHaveAttribute(
      'href',
      '/developers/plugins'
    );
  });

  test('recent activity card lists request log rows with status codes', () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    render(<DeveloperPortalHome />);
    expect(screen.getByText(/POST \/fhir\/Appointment/)).toBeInTheDocument();
    expect(screen.getByText('201')).toBeInTheDocument();
    expect(screen.getByText('422')).toBeInTheDocument();
    expect(screen.getByText(/Full request log in API keys/).closest('a')).toHaveAttribute(
      'href',
      '/developers/api-keys'
    );
  });

  test('renders the bespoke phone layout below the phone breakpoint', () => {
    mockIsPhone.mockReturnValue(true);
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    render(<DeveloperPortalHome />);

    const phone = screen.getByTestId('phone-dev-home');
    expect(phone).toHaveTextContent('Ada Lovelace');
    // The four desktop recent-activity entries are handed to the phone log.
    expect(phone).toHaveAttribute('data-activity-count', '4');
    // Desktop-only sections are not rendered on phone.
    expect(screen.queryByText('FHIR-NATIVE API')).not.toBeInTheDocument();
    expect(screen.queryByText('Quick status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('primary-View docs')).not.toBeInTheDocument();
  });
});
