'use client';
import React, { useId, useState } from 'react';
import { AxiosError } from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';

import { useErrorTost } from '@/app/ui/overlays/Toast/Toast';
import { useAuthStore } from '@/app/stores/authStore';
import FormInputPass from '@/app/ui/inputs/FormInputPass/FormInputPass';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';

import './ForgotPassword.css';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { getEmailValidationError, normalizeEmail } from '@/app/lib/validators';

const OTP_DIGIT_KEYS = [
  'otp-digit-1',
  'otp-digit-2',
  'otp-digit-3',
  'otp-digit-4',
  'otp-digit-5',
  'otp-digit-6',
] as const;

const scrollToTop = () => {
  if (globalThis.window) {
    globalThis.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

const dangerToast = (message: string) => ({
  message,
  errortext: 'Error',
  iconElement: (
    <Icon
      icon="solar:danger-triangle-bold"
      width="20"
      height="20"
      color="var(--color-danger-600)"
    />
  ),
  className: 'errofoundbg',
});

const successToast = (message: string) => ({
  message,
  errortext: 'Success',
  iconElement: (
    <Icon
      icon="solar:danger-triangle-bold"
      width="20"
      height="20"
      color="var(--color-success-bright)"
    />
  ),
  className: 'CongratsBg',
});

const INITIAL_RESET_FORM = {
  showNewPassword: false,
  password: '',
  confirmPassword: '',
  otp: ['', '', '', '', '', ''],
};

type EmailStepProps = {
  email: string;
  error?: string;
  setEmail: (value: string) => void;
  clearEmailError: () => void;
  onSendCode: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

const EmailStep = ({ email, error, setEmail, clearEmailError, onSendCode }: EmailStepProps) => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-2">
      <h1 className="text-display-2 text-text-primary text-center">Forgot password?</h1>
      <div className="text-body-4 text-text-primary text-center">
        {' '}
        Enter your registered email, and we’ll send you a code to reset it.
      </div>
    </div>
    <div className="flex flex-col gap-6">
      <FormInput
        intype="email"
        inname="email"
        value={email}
        inlabel="Email Address"
        onChange={(e) => {
          setEmail(e.target.value);
          clearEmailError();
        }}
        error={error}
      />
      <div className="flex flex-col gap-2">
        <Primary href="#" onClick={onSendCode} text="Send code" />
        <Secondary href="/signin" text="Back" />
      </div>
    </div>
  </div>
);

type OtpStepProps = {
  otp: string[];
  otpError?: string;
  otpHintId: string;
  otpErrorId?: string;
  otpDescribedBy: string;
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    index: number
  ) => void;
  handleKeyDown: (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    index: number
  ) => void;
  onVerify: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onBack: () => void;
  onResend: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

const OtpStep = ({
  otp,
  otpError,
  otpHintId,
  otpErrorId,
  otpDescribedBy,
  handleChange,
  handleKeyDown,
  onVerify,
  onBack,
  onResend,
}: OtpStepProps) => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-2">
      <h1 className="text-display-2 text-text-primary text-center">Verify code</h1>
      <div className="text-body-4 text-text-primary text-center">
        {' '}
        Enter the code we just sent to your email to proceed with resetting your password.
      </div>
    </div>

    <fieldset
      className="verifyInput"
      aria-label="Verification code"
      aria-describedby={otpDescribedBy}
    >
      {otp.map((digit, index) => (
        <input
          key={OTP_DIGIT_KEYS[index]}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={digit}
          id={`otp-input-${index}`}
          aria-label={`Digit ${index + 1} of 6`}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          maxLength={1}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
        />
      ))}
    </fieldset>
    <p id={otpHintId} className="text-caption-1 text-text-secondary text-center">
      Enter the 6-digit code from your email.
    </p>
    {otpError ? (
      <div
        id={otpErrorId}
        role="alert"
        className="flex items-center justify-center gap-1 text-caption-2 text-text-error"
      >
        <Icon icon="solar:danger-circle-bold" width="16" height="16" aria-hidden="true" />
        <span>{otpError}</span>
      </div>
    ) : null}

    <div className="flex flex-col gap-3 items-center w-full">
      <Primary href="#" onClick={onVerify} text="Verify code" style={{ width: '100%' }} />
      <Secondary href="#" text="Back" onClick={onBack} style={{ width: '100%' }} />
      <div className="text-body-4 text-text-primary">
        {' '}
        Didn&apos;t receive the code?{' '}
        <Link href="#" onClick={onResend} className="text-text-brand">
          Request New Code
        </Link>
      </div>
    </div>
  </div>
);

type NewPasswordStepProps = {
  password: string;
  confirmPassword: string;
  passwordError?: string;
  confirmPasswordError?: string;
  setPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  clearPasswordErrors: () => void;
  onSubmit: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onBack: () => void;
};

const NewPasswordStep = ({
  password,
  confirmPassword,
  passwordError,
  confirmPasswordError,
  setPassword,
  setConfirmPassword,
  clearPasswordErrors,
  onSubmit,
  onBack,
}: NewPasswordStepProps) => (
  <div className="flex flex-col gap-6 w-full">
    <div className="flex flex-col gap-6 w-full">
      <h1 className="text-display-2 text-text-primary text-center">Set new password</h1>
      <div className="flex flex-col gap-3">
        <FormInputPass
          intype="password"
          inname="password"
          value={password}
          inlabel="Enter New Password"
          onChange={(e) => {
            setPassword(e.target.value);
            clearPasswordErrors();
          }}
          error={passwordError}
        />
        <FormInputPass
          intype="password"
          inname="confirmPassword"
          value={confirmPassword}
          inlabel="Confirm Password"
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            clearPasswordErrors();
          }}
          error={confirmPasswordError}
        />
      </div>
    </div>
    <div className="flex flex-col gap-3 w-full">
      <Primary href="#" onClick={onSubmit} text="Reset password" />
      <Secondary href="#" text="Back" onClick={onBack} />
    </div>
  </div>
);

const ForgotPassword = () => {
  const router = useRouter();
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  const { forgotPassword, resetPassword } = useAuthStore();

  const [showVerifyCode, setShowVerifyCode] = useState(false);
  const [email, setEmail] = useState('');
  const [resetForm, setResetForm] = useState(INITIAL_RESET_FORM);
  const { showNewPassword, password, confirmPassword, otp } = resetForm;
  const setShowNewPassword = (value: boolean) =>
    setResetForm((form) => ({ ...form, showNewPassword: value }));
  const setPassword = (value: string) => setResetForm((form) => ({ ...form, password: value }));
  const setConfirmPassword = (value: string) =>
    setResetForm((form) => ({ ...form, confirmPassword: value }));
  const setOtp = (value: string[]) => setResetForm((form) => ({ ...form, otp: value }));
  const [inputErrors, setInputErrors] = useState<{
    email?: string;
    otp?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const otpHintId = useId();
  const otpErrorId = inputErrors.otp ? `${otpHintId}-error` : undefined;
  const otpDescribedBy = [otpHintId, otpErrorId].filter(Boolean).join(' ');

  const clearOtpError = () => {
    setInputErrors((prev) => ({ ...prev, otp: undefined }));
  };

  const clearPasswordErrors = () => {
    setInputErrors((prev) => ({ ...prev, password: undefined, confirmPassword: undefined }));
  };

  const resetPasswordFormState = () => {
    setResetForm(INITIAL_RESET_FORM);
    setInputErrors({});
  };

  const getPasswordValidationErrors = () => {
    if (!password || !confirmPassword) {
      return {
        password: password ? undefined : 'Enter a new password',
        confirmPassword: confirmPassword ? undefined : 'Confirm your new password',
      };
    }

    if (password !== confirmPassword) {
      return {
        password: undefined,
        confirmPassword: 'Passwords do not match',
      };
    }

    return null;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    index: number
  ) => {
    const value = e.target.value;

    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    clearOtpError();

    if (value && index < otp.length - 1) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    index: number
  ) => {
    if (e.key === 'Backspace' && otp[index] === '') {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleOtp = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    const emailError = getEmailValidationError(
      normalizedEmail,
      'Email is required',
      'Enter a valid email'
    );

    if (emailError) {
      setInputErrors((prev) => ({ ...prev, email: emailError }));
      if (globalThis.window) {
        globalThis.scrollTo({ top: 0, behavior: 'smooth' });
      }
      showErrorTost(dangerToast(emailError));
      return;
    }

    try {
      const data = await forgotPassword(normalizedEmail);
      if (data) {
        setInputErrors({});
        if (globalThis.window) {
          globalThis.scrollTo({ top: 0, behavior: 'smooth' });
        }
        showErrorTost(
          successToast('If an account with this email exists, a reset code has been sent')
        );
        setShowVerifyCode(true);
      }
    } catch (error: unknown) {
      if (globalThis.window) {
        globalThis.scrollTo({ top: 0, behavior: 'smooth' });
      }
      const axiosError = error as AxiosError<{ message: string }>;
      showErrorTost(
        dangerToast(
          `OTP failed: ${axiosError.response?.data?.message || 'Unable to connect to the server.'}`
        )
      );
    }
  };

  const handleVerifyOtp = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    if (otp.includes('')) {
      setInputErrors((prev) => ({ ...prev, otp: 'Enter the full 6-digit verification code' }));
      if (globalThis.window) {
        globalThis.scrollTo({ top: 0, behavior: 'smooth' });
      }
      showErrorTost(dangerToast('Please enter the full OTP'));
      return;
    }

    setShowNewPassword(true);
    setShowVerifyCode(false);
    clearOtpError();
  };

  const handlePasswordChange = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    const passwordErrors = getPasswordValidationErrors();
    if (passwordErrors) {
      setInputErrors(passwordErrors);
      scrollToTop();
      showErrorTost(
        dangerToast(
          passwordErrors.confirmPassword === 'Passwords do not match'
            ? 'Passwords do not match'
            : 'Both Passwords are required'
        )
      );
      return;
    }

    try {
      clearPasswordErrors();
      const success = await resetPassword(password);
      if (success) {
        showErrorTost(successToast('Password Changed successfully'));
        setTimeout(() => {
          router.push('/signin');
        }, 3000);
        setTimeout(() => {
          setShowVerifyCode(false);
          resetPasswordFormState();
        }, 5000);
      }
    } catch (error: any) {
      scrollToTop();
      if (error?.code === 'CodeMismatchException') {
        setShowVerifyCode(true);
        showErrorTost(dangerToast('Code Mismatch'));
      } else {
        setShowVerifyCode(false);
        showErrorTost(dangerToast('Something went wrong'));
      }
      resetPasswordFormState();
    }
  };

  return (
    <section
      className={`
        relative flex w-full flex-1 items-center justify-center
        bg-cover bg-center bg-no-repeat
        min-h-[max(720px,100vh)]
        pt-22
      `}
      style={{ backgroundImage: `url(${MEDIA_SOURCES.auth.background})` }}
    >
      {ErrorTostPopup}
      <div
        className={`
          flex h-fit w-112.5 flex-col items-center justify-center gap-6
          rounded-3xl border border-card-border
          bg-(--whitebg)
          p-5
          elevation-1
        `}
      >
        {!showVerifyCode && !showNewPassword && (
          <EmailStep
            email={email}
            error={inputErrors.email}
            setEmail={setEmail}
            clearEmailError={() => setInputErrors((prev) => ({ ...prev, email: undefined }))}
            onSendCode={handleOtp}
          />
        )}

        {showVerifyCode && (
          <OtpStep
            otp={otp}
            otpError={inputErrors.otp}
            otpHintId={otpHintId}
            otpErrorId={otpErrorId}
            otpDescribedBy={otpDescribedBy}
            handleChange={handleChange}
            handleKeyDown={handleKeyDown}
            onVerify={handleVerifyOtp}
            onBack={() => setShowVerifyCode(false)}
            onResend={handleOtp}
          />
        )}

        {showNewPassword && (
          <NewPasswordStep
            password={password}
            confirmPassword={confirmPassword}
            passwordError={inputErrors.password}
            confirmPasswordError={inputErrors.confirmPassword}
            setPassword={setPassword}
            setConfirmPassword={setConfirmPassword}
            clearPasswordErrors={clearPasswordErrors}
            onSubmit={handlePasswordChange}
            onBack={() => setShowNewPassword(false)}
          />
        )}
      </div>
      {ErrorTostPopup}
    </section>
  );
};

export default ForgotPassword;
