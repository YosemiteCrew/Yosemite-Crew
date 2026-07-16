import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const signInMock = jest.fn(() => <div data-testid="dev-signin-page" />);
const signUpMock = jest.fn(() => <div data-testid="dev-signup-page" />);

jest.mock('@/app/features/marketing/pages/DeveloperLanding/DeveloperLanding', () => ({
  __esModule: true,
  default: () => <div data-testid="dev-landing" />,
}));

jest.mock('@/app/features/developers/pages/DeveloperDocs/DeveloperDocs', () => ({
  __esModule: true,
  default: () => <div data-testid="dev-docs" />,
}));

jest.mock('@/app/features/developers/pages/DeveloperPortalHome/DeveloperPortalHome', () => ({
  __esModule: true,
  default: () => <div data-testid="dev-portal-home" />,
}));

jest.mock('@/app/features/developers/pages/DeveloperApiKeys/DeveloperApiKeys', () => ({
  __esModule: true,
  default: () => <div data-testid="dev-api-keys" />,
}));

jest.mock('@/app/features/developers/pages/DeveloperPlugins/DeveloperPlugins', () => ({
  __esModule: true,
  default: () => <div data-testid="dev-plugins" />,
}));

jest.mock(
  '@/app/features/developers/pages/DeveloperWebsiteBuilder/DeveloperWebsiteBuilder',
  () => ({
    __esModule: true,
    default: () => <div data-testid="dev-website-builder" />,
  })
);

jest.mock('@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="dev-guard">{children}</div>,
}));

let mockAuthState: Record<string, unknown> = {};
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

jest.mock('@/app/features/auth/pages/SignIn/SignIn', () => ({
  __esModule: true,
  default: (_props: any) => signInMock(),
}));

jest.mock('@/app/features/auth/pages/SignUp/SignUp', () => ({
  __esModule: true,
  default: (_props: any) => signUpMock(),
}));

import DevelopersRoute from '@/app/(routes)/(public)/developers/page';
import DevSettingsRoute from '@/app/(routes)/(app)/developers/settings/page';
import DevPortalHomeRoute from '@/app/(routes)/(app)/developers/(portal)/home/page';
import DevDocumentationRoute from '@/app/(routes)/(app)/developers/(portal)/documentation/page';
import DevPluginsRoute from '@/app/(routes)/(app)/developers/(portal)/plugins/page';
import DevWebsiteBuilderRoute from '@/app/(routes)/(app)/developers/(portal)/website-builder/page';
import DevApiKeysRoute from '@/app/(routes)/(app)/developers/(portal)/api-keys/page';

describe('developer routes', () => {
  beforeEach(() => {
    mockAuthState = {
      attributes: {
        given_name: 'Grace',
        family_name: 'Hopper',
        email: 'grace@example.com',
      },
      role: 'developer',
      user: { getUsername: () => 'graceh' },
    };
  });

  test('root developer route renders landing page', () => {
    render(<DevelopersRoute />);
    expect(screen.getByTestId('dev-landing')).toBeInTheDocument();
  });

  test('settings route renders profile inside guard', () => {
    render(<DevSettingsRoute />);
    expect(screen.getByTestId('dev-guard')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getAllByText(/Grace Hopper/)[0]).toBeInTheDocument();
    expect(screen.getByText(/grace@example.com/)).toBeInTheDocument();
    expect(screen.getAllByText(/developer/i)[0]).toBeInTheDocument();
  });

  test('settings route falls back to the username, then a generic label', () => {
    mockAuthState = { attributes: null, role: null, user: { getUsername: () => 'graceh' } };
    const { unmount } = render(<DevSettingsRoute />);
    // The redesigned settings page shows the name twice: once as the header
    // username and once as the profile field value.
    expect(screen.getAllByText(/graceh/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Developer/i).length).toBeGreaterThan(0);
    unmount();

    mockAuthState = { attributes: null, role: null, user: null };
    render(<DevSettingsRoute />);
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  test('settings route falls back to the email when no name is set', () => {
    mockAuthState = {
      attributes: { email: 'grace@example.com' },
      role: null,
      user: null,
    };
    render(<DevSettingsRoute />);
    expect(screen.getAllByText(/grace@example.com/).length).toBeGreaterThan(0);
  });

  test('portal home route renders portal component', () => {
    render(<DevPortalHomeRoute />);
    expect(screen.getByTestId('dev-portal-home')).toBeInTheDocument();
  });

  test('documentation route renders developer docs', () => {
    render(<DevDocumentationRoute />);
    expect(screen.getByTestId('dev-docs')).toBeInTheDocument();
  });

  test('plugins route renders plugins component', () => {
    render(<DevPluginsRoute />);
    expect(screen.getByTestId('dev-plugins')).toBeInTheDocument();
  });

  test('website builder route renders website builder component', () => {
    render(<DevWebsiteBuilderRoute />);
    expect(screen.getByTestId('dev-website-builder')).toBeInTheDocument();
  });

  test('api keys route renders api keys component', () => {
    render(<DevApiKeysRoute />);
    expect(screen.getByTestId('dev-api-keys')).toBeInTheDocument();
  });
});
