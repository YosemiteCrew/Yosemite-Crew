import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
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

  test('uses the shared card surface for developer portal cards', async () => {
    useAuthStoreMock.mockReturnValue({
      ...createState({ given_name: 'Ada', family_name: 'Lovelace' }),
    });

    await renderSettled();

    expect(screen.getByText('FHIR-NATIVE API').closest('.dev-hero-copy')).toHaveClass(
      'yc-card-surface'
    );
    expect(
      screen.getByRole('heading', { name: 'Quick links' }).closest('.dev-portal-card')
    ).toHaveClass('yc-card-surface');
    expect(
      screen.getByRole('heading', { name: 'Your API keys' }).closest('.dev-portal-card')
    ).toHaveClass('yc-card-surface');
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

describe('spot-card ink stays on the fixed --spot tokens, not the flipping ones', () => {
  // --ink and --color-ink invert with the site theme; --spot and its --spot-ink/
  // --spot-success companions do not, because the "quick status" / "platform
  // status" cards are pinned near-black in both themes (see the comments above
  // .dev-hero-card and .dev-ph-status). Using the flipping tokens here collapses
  // text-on-background contrast to 1:1 in one of the two themes.
  const readCss = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

  it('keeps the desktop quick-status card off the flipping ink tokens', () => {
    const css = readCss(
      'src/app/features/developers/pages/DeveloperPortalHome/DeveloperPortalHome.css'
    );
    expect(css).not.toMatch(/\.dev-status-(title|value)\s*{[^}]*color:\s*var\(--ink\)/);
    expect(css).not.toMatch(/\.dev-status-label\s*{[^}]*var\(--ink\)/);
    expect(css).toContain('background: var(--spot);');
  });

  it('keeps the phone platform-status card off the flipping ink and background tokens', () => {
    const css = readCss(
      'src/app/features/developers/pages/DeveloperPortalHome/PhoneDevHome.css'
    );
    expect(css).not.toMatch(/\.dev-ph-status\s*{[^}]*background:\s*var\(--color-ink\)/);
    expect(css).not.toMatch(/\.dev-ph-status-title\s*{[^}]*color:\s*var\(--ink\)/);
    expect(css).not.toMatch(/\.dev-ph-status-live\s*{[^}]*color:\s*var\(--success-text\)/);
    expect(css).toContain('background: var(--spot);');
    expect(css).toContain('var(--spot-ink)');
    expect(css).toContain('var(--spot-success)');
  });

  it('declares --spot-success in both theme blocks, matching the --spot-ink pattern', () => {
    const css = readCss('src/app/globals.css');
    const occurrences = css.match(/--spot-success:\s*#9be8c9;/g) ?? [];
    expect(occurrences).toHaveLength(2);
  });
});
