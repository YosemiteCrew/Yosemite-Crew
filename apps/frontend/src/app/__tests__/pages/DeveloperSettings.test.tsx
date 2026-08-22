import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const notifyMock = jest.fn();

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: notifyMock }),
}));

jest.mock('@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="dev-guard">{children}</div>,
}));

jest.mock('react-icons/io5', () => ({
  IoCheckmarkCircle: () => <span data-testid="i-check" />,
  IoKeyOutline: () => <span data-testid="i-key" />,
}));

let authState: any;
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: () => authState,
}));

import DeveloperSettings from '@/app/features/developers/pages/DeveloperSettings/DeveloperSettings';

const makeAuth = (payload: any, username = 'devuser') => ({
  attributes: payload ?? null,
  user: { getUsername: () => username },
});

describe('DeveloperSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState = makeAuth({
      given_name: 'Jonas',
      family_name: 'Timm',
      email: 'jonas@timmdevices.de',
      email_verified: true,
      'custom:company': 'Timm Devices GmbH',
    });
  });

  it('renders the live developer profile with a verified email and company claim', () => {
    render(<DeveloperSettings />);

    expect(screen.getByTestId('dev-guard')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getAllByText('Jonas Timm')[0]).toBeInTheDocument();
    expect(screen.getByText('jonas@timmdevices.de')).toBeInTheDocument();
    expect(screen.getByText('Timm Devices GmbH')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('JT')).toBeInTheDocument();
    // No endpoint is configured, so the page says so rather than displaying a
    // real receiver baked into the client bundle alongside a health status
    // nothing had actually measured.
    expect(screen.getByText('Not configured')).toBeInTheDocument();
    expect(screen.queryByText('200 OK')).not.toBeInTheDocument();
  });

  it('accepts email_verified as a string flag', () => {
    authState = makeAuth({
      given_name: 'Ada',
      family_name: 'Lovelace',
      email: 'ada@x.com',
      email_verified: 'true',
    });
    render(<DeveloperSettings />);

    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('falls back to the email as the name and marks it unverified', () => {
    authState = makeAuth({ email: 'dev@x.com' });
    render(<DeveloperSettings />);

    expect(screen.getByText('Unverified')).toBeInTheDocument();
    expect(screen.getByText('Not set')).toBeInTheDocument();
    expect(screen.getAllByText('dev@x.com')[0]).toBeInTheDocument();
    expect(screen.getByText('DE')).toBeInTheDocument();
  });

  it('falls back to the username and a dash email when no session claims exist', () => {
    authState = makeAuth(null, 'graceh');
    render(<DeveloperSettings />);

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('GR')).toBeInTheDocument();
    expect(screen.getAllByText('graceh')[0]).toBeInTheDocument();
  });

  it('falls back to a generic developer name with no session or user', () => {
    authState = { attributes: null, user: undefined };
    render(<DeveloperSettings />);

    // "Developer" appears as the kicker and as the profile name fallback
    expect(screen.getAllByText('Developer').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('DE')).toBeInTheDocument();
  });

  it('toggles each notification switch independently', () => {
    render(<DeveloperSettings />);

    const failures = screen.getByRole('switch', { name: 'Email me on failed deliveries' });
    expect(failures).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(failures);
    expect(failures).toHaveAttribute('aria-checked', 'false');

    const changelog = screen.getByRole('switch', { name: 'Platform changelog emails' });
    expect(changelog).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(changelog);
    expect(changelog).toHaveAttribute('aria-checked', 'true');
  });

  it('confirm-gates revoking all API keys', () => {
    render(<DeveloperSettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Revoke all' }));
    expect(screen.getByRole('button', { name: 'Confirm revoke' })).toBeInTheDocument();

    // Cancel returns to the idle state without notifying
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Revoke all' })).toBeInTheDocument();
    expect(notifyMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Revoke all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm revoke' }));
    expect(notifyMock).toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({ title: 'Key management API coming soon' })
    );
  });

  it('confirm-gates rotating the signing secret', () => {
    render(<DeveloperSettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Rotate now' }));
    expect(screen.getByRole('button', { name: 'Confirm rotate' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Rotate now' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Rotate now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm rotate' }));
    expect(notifyMock).toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({ title: 'Secret rotation coming soon' })
    );
  });

  it('saves notification preferences', () => {
    render(<DeveloperSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(notifyMock).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Notification preferences saved' })
    );
  });
});
