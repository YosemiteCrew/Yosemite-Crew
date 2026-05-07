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

const ForgotPassword = () => {
  const router = useRouter();
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  const { forgotPassword, resetPassword } = useAuthStore();

  const [showVerifyCode, setShowVerifyCode] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
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
      showErrorTost({
        message: emailError,
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
      return;
    }

    try {
      const data = await forgotPassword(normalizedEmail);
      if (data) {
        setInputErrors({});
        if (globalThis.window) {
          globalThis.scrollTo({ top: 0, behavior: 'smooth' });
        }
        showErrorTost({
          message: 'If an account with this email exists, a reset code has been sent',
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
        setShowVerifyCode(true);
      }
    } catch (error: unknown) {
      if (globalThis.window) {
        globalThis.scrollTo({ top: 0, behavior: 'smooth' });
      }
      const axiosError = error as AxiosError<{ message: string }>;
      showErrorTost({
        message: `OTP failed: ${axiosError.response?.data?.message || 'Unable to connect to the server.'}`,
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
    }
  };

  const handleVerifyOtp = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    if (otp.includes('')) {
      setInputErrors((prev) => ({ ...prev, otp: 'Enter the full 6-digit verification code' }));
      if (globalThis.window) {
        globalThis.scrollTo({ top: 0, behavior: 'smooth' });
      }
      showErrorTost({
        message: 'Please enter the full OTP',
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
      return;
    }

    setShowNewPassword(true);
    setShowVerifyCode(false);
    clearOtpError();
  };

  const handlePasswordChange = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      setInputErrors({
        password: password ? undefined : 'Enter a new password',
        confirmPassword: confirmPassword ? undefined : 'Confirm your new password',
      });
      if (globalThis.window) {
        globalThis.scrollTo({ top: 0, behavior: 'smooth' });
      }
      showErrorTost({
        message: 'Both Passwords are required',
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
      return;
    }

    if (password !== confirmPassword) {
      setInputErrors({
        password: undefined,
        confirmPassword: 'Passwords do not match',
      });
      if (globalThis.window) {
        globalThis.scrollTo({ top: 0, behavior: 'smooth' });
      }
      showErrorTost({
        message: 'Passwords do not match',
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
      return;
    }

    try {
      clearPasswordErrors();
      const success = await resetPassword(email, otp.join(''), password);
      if (success) {
        showErrorTost({
          message: 'Password Changed successfully',
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
        setTimeout(() => {
          router.push('/signin');
        }, 3000);
        setTimeout(() => {
          setShowNewPassword(false);
          setShowVerifyCode(false);
          setPassword('');
          setConfirmPassword('');
          setOtp(['', '', '', '', '', '']);
          setInputErrors({});
        }, 5000);
      }
    } catch (error: any) {
      if (globalThis.window) {
        globalThis.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (error?.code === 'CodeMismatchException') {
        setShowVerifyCode(true);
        showErrorTost({
          message: 'Code Mismatch',
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
      } else {
        setShowVerifyCode(false);
        showErrorTost({
          message: 'Something went wrong',
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
      }
      setShowNewPassword(false);
      setPassword('');
      setConfirmPassword('');
      setOtp(['', '', '', '', '', '']);
      setInputErrors({});
    }
  };

  return (
    <section
      className={`
        relative flex w-full flex-1 items-center justify-center
        bg-cover bg-center bg-no-repeat
        h-[calc(100vh-80px)]
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
                  setInputErrors((prev) => ({ ...prev, email: undefined }));
                }}
                error={inputErrors.email}
              />
              <div className="flex flex-col gap-2">
                <Primary href="#" onClick={handleOtp} text="Send code" />
                <Secondary href="/signin" text="Back" />
              </div>
            </div>
          </div>
        )}

        {showVerifyCode && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-display-2 text-text-primary text-center">Verify code</h1>
              <div className="text-body-4 text-text-primary text-center">
                {' '}
                Enter the code we just sent to your email to proceed with resetting your password.
              </div>
            </div>

            <div
              className="verifyInput"
              role="group"
              aria-label="Verification code"
              aria-describedby={otpDescribedBy}
            >
              {otp.map((digit, index) => (
                <input
                  key={`${digit}-${index}`}
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
            </div>
            <p id={otpHintId} className="text-caption-1 text-text-secondary text-center">
              Enter the 6-digit code from your email.
            </p>
            {inputErrors.otp ? (
              <div
                id={otpErrorId}
                role="alert"
                className="flex items-center justify-center gap-1 text-caption-2 text-text-error"
              >
                <Icon icon="solar:danger-circle-bold" width="16" height="16" aria-hidden="true" />
                <span>{inputErrors.otp}</span>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 items-center w-full">
              <Primary
                href="#"
                onClick={handleVerifyOtp}
                text="Verify code"
                style={{ width: '100%' }}
              />
              <Secondary
                href="#"
                text="Back"
                onClick={() => setShowVerifyCode(false)}
                style={{ width: '100%' }}
              />
              <div className="text-body-4 text-text-primary">
                {' '}
                Didn&apos;t receive the code?{' '}
                <Link href="#" onClick={handleOtp} className="text-text-brand">
                  Request New Code
                </Link>
              </div>
            </div>
          </div>
        )}

        {showNewPassword && (
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
                  error={inputErrors.password}
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
                  error={inputErrors.confirmPassword}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <Primary href="#" onClick={handlePasswordChange} text="Reset password" />
              <Secondary href="#" text="Back" onClick={() => setShowNewPassword(false)} />
            </div>
          </div>
        )}
      </div>
      {ErrorTostPopup}
    </section>
  );
};

export default ForgotPassword;
