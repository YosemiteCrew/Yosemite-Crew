import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TOTP from 'supertokens-web-js/recipe/totp';

import SecuritySection from '@/app/features/settings/pages/Settings/Sections/SecuritySection';
import { getData, postData } from '@/app/services/axios';
import { useNotify } from '@/app/hooks/useNotify';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(),
}));

jest.mock('supertokens-web-js/recipe/totp', () => ({
  __esModule: true,
  default: {
    createDevice: jest.fn(),
    verifyDevice: jest.fn(),
  },
}));

jest.mock('@/app/ui', () => ({
  Button: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value} onChange={onChange} />
      {error && <span data-testid="code-error">{error}</span>}
    </label>
  ),
}));

const mockGetData = getData as jest.Mock;
const mockPostData = postData as jest.Mock;
const mockCreateDevice = TOTP.createDevice as jest.Mock;
const mockVerifyDevice = TOTP.verifyDevice as jest.Mock;

const statusResponse = (totp: { required: boolean; setup: boolean }) => ({
  data: {
    status: 'OK',
    mfa: {
      requiredFactors: totp.required ? ['totp'] : ['otp-email'],
      setupFactors: totp.setup ? ['totp'] : [],
      totp,
    },
  },
});

describe('SecuritySection', () => {
  const mockNotify = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotify as jest.Mock).mockReturnValue({ notify: mockNotify });
    mockGetData.mockResolvedValue(statusResponse({ required: false, setup: false }));
    mockPostData.mockResolvedValue({ data: { status: 'OK' } });
  });

  const renderSection = async () => {
    render(<SecuritySection />);
    await waitFor(() => expect(mockGetData).toHaveBeenCalledWith('/v1/auth/mfa/status'));
    // Wait for the async status state update to land so actions are enabled.
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: /Set up authenticator app|Disable authenticator/,
        })
      ).toBeEnabled()
    );
  };

  const startEnrollment = async () => {
    mockCreateDevice.mockResolvedValue({
      status: 'OK',
      deviceName: 'Authenticator app',
      secret: 'SECRET123',
      qrCodeString: 'otpauth://totp/demo',
    });
    await renderSection();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Set up authenticator app' }));
    });
  };

  it('renders the MFA status once loaded', async () => {
    await renderSection();

    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByTestId('totp-status')).toHaveTextContent('Authenticator app: Not enabled');
    expect(screen.getByRole('button', { name: 'Set up authenticator app' })).toBeInTheDocument();
  });

  it('shows the enabled state and a disable action when TOTP is active', async () => {
    mockGetData.mockResolvedValue(statusResponse({ required: true, setup: true }));
    await renderSection();

    expect(screen.getByTestId('totp-status')).toHaveTextContent('Authenticator app: Enabled');
    expect(screen.getByRole('button', { name: 'Disable authenticator' })).toBeInTheDocument();
  });

  it('keeps setup disabled when the status request fails', async () => {
    mockGetData.mockRejectedValue(new Error('status down'));
    render(<SecuritySection />);

    await waitFor(() => expect(mockGetData).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Set up authenticator app' })).toBeDisabled();
  });

  it('starts TOTP enrollment and reveals the secret', async () => {
    await startEnrollment();

    expect(mockPostData).toHaveBeenCalledWith('/v1/auth/mfa/totp/enable');
    expect(mockCreateDevice).toHaveBeenCalledWith({ deviceName: 'Authenticator app' });
    expect(screen.getByTestId('totp-secret')).toHaveTextContent('SECRET123');
    expect(screen.getByLabelText('6-digit code')).toBeInTheDocument();
  });

  it('notifies when a device already exists', async () => {
    mockCreateDevice.mockResolvedValue({ status: 'DEVICE_ALREADY_EXISTS_ERROR' });
    await renderSection();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Set up authenticator app' }));
    });

    expect(mockNotify).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ title: 'Authenticator already exists' })
    );
    expect(screen.queryByTestId('totp-secret')).not.toBeInTheDocument();
  });

  it('notifies when enrollment cannot start', async () => {
    mockPostData.mockRejectedValue(new Error('enable down'));
    await renderSection();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Set up authenticator app' }));
    });

    expect(mockNotify).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ title: 'Unable to start setup' })
    );
  });

  it('requires a code before verifying the device', async () => {
    await startEnrollment();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    });

    expect(screen.getByTestId('code-error')).toHaveTextContent('Enter the 6-digit code');
    expect(mockVerifyDevice).not.toHaveBeenCalled();
  });

  it('verifies the device and refreshes the status', async () => {
    mockVerifyDevice.mockResolvedValue({ status: 'OK', wasAlreadyVerified: false });
    await startEnrollment();

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    });

    expect(mockVerifyDevice).toHaveBeenCalledWith({
      deviceName: 'Authenticator app',
      totp: '123456',
    });
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Authenticator enabled' })
    );
    expect(screen.queryByTestId('totp-secret')).not.toBeInTheDocument();
  });

  it('shows an inline error for invalid codes', async () => {
    mockVerifyDevice.mockResolvedValue({
      status: 'INVALID_TOTP_ERROR',
      currentNumberOfFailedAttempts: 1,
      maxNumberOfFailedAttempts: 5,
    });
    await startEnrollment();

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '000000' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    });

    expect(screen.getByTestId('code-error')).toHaveTextContent('Invalid code. Please try again.');
  });

  it('shows an inline error when the attempt limit is reached', async () => {
    mockVerifyDevice.mockResolvedValue({ status: 'LIMIT_REACHED_ERROR', retryAfterMs: 1000 });
    await startEnrollment();

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '000000' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    });

    expect(screen.getByTestId('code-error')).toHaveTextContent(
      'Too many attempts. Please try again later.'
    );
  });

  it('asks the user to restart when the device is unknown', async () => {
    mockVerifyDevice.mockResolvedValue({ status: 'UNKNOWN_DEVICE_ERROR' });
    await startEnrollment();

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '000000' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    });

    expect(screen.getByTestId('code-error')).toHaveTextContent(
      'Verification failed. Please restart the setup.'
    );
  });

  it('notifies when the verification call fails', async () => {
    mockVerifyDevice.mockRejectedValue(new Error('verify down'));
    await startEnrollment();

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    });

    expect(mockNotify).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ title: 'Verification failed' })
    );
  });

  it('cancels enrollment and returns to the summary', async () => {
    await startEnrollment();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByTestId('totp-secret')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set up authenticator app' })).toBeInTheDocument();
  });

  it('disables TOTP and refreshes the status', async () => {
    mockGetData.mockResolvedValue(statusResponse({ required: true, setup: true }));
    await renderSection();

    mockGetData.mockResolvedValue(statusResponse({ required: false, setup: false }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Disable authenticator' }));
    });

    expect(mockPostData).toHaveBeenCalledWith('/v1/auth/mfa/totp/disable');
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Authenticator disabled' })
    );
    expect(screen.getByTestId('totp-status')).toHaveTextContent('Authenticator app: Not enabled');
  });

  it('notifies when disabling fails', async () => {
    mockGetData.mockResolvedValue(statusResponse({ required: true, setup: true }));
    await renderSection();

    mockPostData.mockRejectedValue(new Error('disable down'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Disable authenticator' }));
    });

    expect(mockNotify).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ title: 'Unable to disable' })
    );
  });
});
