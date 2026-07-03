import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import OtpModal from '@/app/ui/overlays/OtpModal/OtpModal';
import { useAuthStore } from '@/app/stores/authStore';

// --- Mocks ---

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/app/ui/overlays/Modal/ModalBase', () => ({
  __esModule: true,
  default: ({ children, showModal, canClose }: any) => {
    // Exercise the canClose guard the way the real ModalBase does before
    // dismissing on overlay clicks.
    canClose?.();
    return showModal ? <div data-testid="modal-base">{children}</div> : null;
  },
}));

jest.mock('@/app/ui', () => ({
  Button: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: () => <span data-testid="close-icon" />,
}));

expect.extend(toHaveNoViolations);

describe('OtpModal (email verification link modal)', () => {
  const mockResendVerificationEmail = jest.fn();
  const mockShowErrorTost = jest.fn();
  const mockSetShowVerifyModal = jest.fn();

  const defaultProps = {
    email: 'jane@example.com',
    showErrorTost: mockShowErrorTost,
    showVerifyModal: true,
    setShowVerifyModal: mockSetShowVerifyModal,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ resendVerificationEmail: mockResendVerificationEmail })
    );
    Object.defineProperty(globalThis, 'scrollTo', { value: jest.fn(), writable: true });
  });

  it('renders the verification link instructions with the email', () => {
    render(<OtpModal {...defaultProps} />);

    expect(screen.getByText('Verify Email Address')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(
      screen.getByText(/click the verification link to activate your account/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend Verification Link' })).toBeInTheDocument();
  });

  it('renders nothing when hidden', () => {
    render(<OtpModal {...defaultProps} showVerifyModal={false} />);
    expect(screen.queryByText('Verify Email Address')).not.toBeInTheDocument();
  });

  it('resends the verification link and shows a success toast', async () => {
    mockResendVerificationEmail.mockResolvedValue('OK');
    render(<OtpModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resend Verification Link' }));
    });

    expect(mockResendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'A new verification link has been sent to your email.',
        errortext: 'Link Sent',
      })
    );
  });

  it('tells the user when the email is already verified', async () => {
    mockResendVerificationEmail.mockResolvedValue('ALREADY_VERIFIED');
    render(<OtpModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resend Verification Link' }));
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Your email is already verified. You can sign in now.',
        errortext: 'Already Verified',
      })
    );
  });

  it('shows an error toast when the resend fails', async () => {
    mockResendVerificationEmail.mockRejectedValue(new Error('mail down'));
    render(<OtpModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resend Verification Link' }));
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'mail down', errortext: 'Error' })
    );
  });

  it('shows a generic error for non-Error rejections', async () => {
    mockResendVerificationEmail.mockRejectedValue('nope');
    render(<OtpModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resend Verification Link' }));
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Error resending the link.' })
    );
  });

  it('disables the resend button while sending', async () => {
    let resolveResend: ((value: string) => void) | undefined;
    mockResendVerificationEmail.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveResend = resolve;
        })
    );
    render(<OtpModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resend Verification Link' }));
    });

    expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();

    await act(async () => {
      resolveResend?.('OK');
    });
  });

  it('closes via the close button', () => {
    render(<OtpModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close verification modal' }));

    expect(mockSetShowVerifyModal).toHaveBeenCalledWith(false);
  });

  it('closes via the change email action', () => {
    render(<OtpModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Change Email' }));

    expect(mockSetShowVerifyModal).toHaveBeenCalledWith(false);
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(<OtpModal {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
