import React from 'react';
import { render, screen, act } from '@testing-library/react';
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

jest.mock('@/app/ui/icons/Icon', () => ({
  __esModule: true,
  Icon: ({ icon }: any) => <span data-testid={`icon-${icon}`} />,
}));

const mockIsPhone = jest.fn(() => false);
jest.mock('@/app/ui/layout/PhoneShell/useIsPhone', () => ({
  __esModule: true,
  useIsPhone: () => mockIsPhone(),
  default: () => mockIsPhone(),
}));

const listApiKeysMock = jest.fn();
const getUsageMock = jest.fn();

jest.mock('@/app/services/developerApiKeys', () => ({
  listApiKeys: (...args: unknown[]) => listApiKeysMock(...args),
}));

jest.mock('@/app/services/developerUsage', () => ({
  getUsage: (...args: unknown[]) => getUsageMock(...args),
}));

jest.mock('@/app/features/developers/pages/DeveloperPortalHome/PhoneDevHome', () => ({
  __esModule: true,
  default: ({ displayName }: any) => <div data-testid="phone-dev-home">{displayName}</div>,
}));

import DeveloperPortalHome from '@/app/features/developers/pages/DeveloperPortalHome/DeveloperPortalHome';

/*
 * The status card now performs two reads on mount, so every render has pending
 * state. Settle it before asserting or React reports an act(...) warning that
 * jest.setup promotes to a failure.
 */
const renderSettled = async () => {
  render(<DeveloperPortalHome />);
  await act(async () => {
    await Promise.resolve();
  });
};

const createState = (attributes: Record<string, string>) => ({
  attributes,
});

describe('DeveloperPortalHome page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPhone.mockReturnValue(false);
    listApiKeysMock.mockResolvedValue([]);
    getUsageMock.mockResolvedValue({ billingPeriod: '2026-09', callCount: 0, limit: 1000 });
  });

  test('renders developer home content when authenticated', async () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({
        given_name: 'Ada',
        family_name: 'Lovelace',
      }),
    });

    await renderSettled();

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

  test('shows fallback name when no user name is available', async () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({}),
    });

    await renderSettled();

    expect(screen.getByRole('heading', { name: /Welcome back, Developer/i })).toBeInTheDocument();
  });

  test('uses email as fallback when name is not provided', async () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({
        email: 'test@example.com',
      }),
    });

    await renderSettled();

    expect(
      screen.getByRole('heading', { name: /Welcome back, test@example.com/i })
    ).toBeInTheDocument();
  });

  test('has no axe violations', async () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    const { container } = render(<DeveloperPortalHome />);
    await act(async () => {
      await Promise.resolve();
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('the Welcome back greeting is the page h1 and no Developer Home heading remains', async () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    await renderSettled();
    expect(
      screen.getByRole('heading', { level: 1, name: /Welcome back, Ada Lovelace/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Developer Home/i })).not.toBeInTheDocument();
  });

  test('quick status card shows the Next step and Portal access rows', async () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    await renderSettled();
    expect(screen.getByText('Quick status')).toBeInTheDocument();
    expect(screen.getByText('Portal access')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Browse documentation →')).toBeInTheDocument();
  });

  test('renders the FHIR-native hero card with a Create an API key action', async () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    await renderSettled();
    expect(screen.getByText('FHIR-NATIVE API')).toBeInTheDocument();
    expect(
      screen.getByText(/One API for appointments, patients, and records/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('secondary-Create an API key')).toHaveAttribute(
      'href',
      '/developers/api-keys'
    );
  });

  test('quick status reads the real key count and call count', async () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    listApiKeysMock.mockResolvedValue([
      { id: 'k1', status: 'active' },
      { id: 'k2', status: 'revoked' },
      { id: 'k3', status: 'active' },
    ]);
    getUsageMock.mockResolvedValue({ billingPeriod: '2026-09', callCount: 1234, limit: 1000 });

    await renderSettled();

    expect(screen.getByText('Active API keys')).toBeInTheDocument();
    expect(screen.getByText('API calls this period')).toBeInTheDocument();
    // Only the active keys count.
    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(await screen.findByText('1,234')).toBeInTheDocument();
  });

  test('shows a dash rather than a number when the reads fail', async () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    listApiKeysMock.mockRejectedValue(new Error('nope'));
    getUsageMock.mockRejectedValue(new Error('nope'));

    await renderSettled();

    expect(await screen.findAllByText('—')).toHaveLength(2);
  });

  test('states no invented request throughput', async () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    await renderSettled();
    expect(screen.queryByText('Requests · 24h')).not.toBeInTheDocument();
    expect(screen.queryByText('4,218')).not.toBeInTheDocument();
    expect(screen.queryByText('Sandbox')).not.toBeInTheDocument();
  });

  test('renders all four quick links including Quickstart and GitHub', async () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    await renderSettled();
    expect(screen.getByText(/Quickstart · first request in 5 minutes/i)).toBeInTheDocument();
    expect(screen.getByText('Partner with Yosemite Crew')).toBeInTheDocument();
    expect(screen.getByText('Security & compliance')).toBeInTheDocument();
    const github = screen.getByText('github.com/YosemiteCrew').closest('a');
    expect(github).toHaveAttribute('href', 'https://github.com/YosemiteCrew');
    expect(github).toHaveAttribute('target', '_blank');
  });

  test('shows no plugin card, because there is no plugin model', async () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    await renderSettled();
    expect(screen.queryByRole('heading', { name: 'Your plugin' })).not.toBeInTheDocument();
    expect(screen.queryByText('Anesthesia monitor sync')).not.toBeInTheDocument();
    expect(screen.queryByText('v0.4.1 · submitted 04 Jul')).not.toBeInTheDocument();
  });

  test('shows no request log, because nothing records one', async () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    await renderSettled();
    expect(screen.queryByText(/POST \/fhir\/Appointment/)).not.toBeInTheDocument();
    expect(screen.queryByText('422')).not.toBeInTheDocument();
    expect(screen.queryByText(/Full request log in API keys/)).not.toBeInTheDocument();
    // The card it was replaced with points at a surface that does exist.
    expect(screen.getByRole('heading', { name: 'Your API keys' })).toBeInTheDocument();
  });

  test('renders the bespoke phone layout below the phone breakpoint', async () => {
    mockIsPhone.mockReturnValue(true);
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    await renderSettled();

    const phone = screen.getByTestId('phone-dev-home');
    expect(phone).toHaveTextContent('Ada Lovelace');
    // Desktop-only sections are not rendered on phone.
    expect(screen.queryByText('FHIR-NATIVE API')).not.toBeInTheDocument();
    expect(screen.queryByText('Quick status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('primary-View docs')).not.toBeInTheDocument();
  });
});
