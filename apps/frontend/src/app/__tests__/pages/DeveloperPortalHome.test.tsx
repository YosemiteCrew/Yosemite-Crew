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

import DeveloperPortalHome from '@/app/features/developers/pages/DeveloperPortalHome/DeveloperPortalHome';

const createSession = (payload: any) => ({
  getIdToken: () => ({
    decodePayload: () => payload,
  }),
});

describe('DeveloperPortalHome page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders developer home content when authenticated', () => {
    useAuthStoreMock.mockReturnValue({
      session: createSession({
        given_name: 'Ada',
        family_name: 'Lovelace',
      }),
    });

    render(<DeveloperPortalHome />);

    expect(screen.getByTestId('dev-guard')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Developer Home/i })).toBeInTheDocument();
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
      session: createSession({}),
    });

    render(<DeveloperPortalHome />);

    expect(screen.getByRole('heading', { name: /Welcome back, Developer/i })).toBeInTheDocument();
  });

  test('uses email as fallback when name is not provided', () => {
    useAuthStoreMock.mockReturnValue({
      session: createSession({
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
      session: createSession({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    const { container } = render(<DeveloperPortalHome />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('Developer Home uses h1 and Welcome back uses h2', () => {
    useAuthStoreMock.mockReturnValue({
      session: createSession({ given_name: 'Ada', family_name: 'Lovelace' }),
    });
    render(<DeveloperPortalHome />);
    expect(screen.getByRole('heading', { level: 1, name: /Developer Home/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Welcome back/i })).toBeInTheDocument();
  });
});
