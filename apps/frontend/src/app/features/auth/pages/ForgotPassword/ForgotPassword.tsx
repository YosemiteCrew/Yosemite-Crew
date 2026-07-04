'use client';
import React, { useId, useState } from 'react';
import { AxiosError } from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import {
  IoAlertCircleOutline,
  IoArrowForwardOutline,
  IoEyeOffOutline,
  IoEyeOutline,
  IoGitBranchOutline,
  IoLockClosedOutline,
  IoMailOpenOutline,
  IoShieldCheckmarkOutline,
} from 'react-icons/io5';

import { useErrorTost } from '@/app/ui/overlays/Toast/Toast';
import { useAuthStore } from '@/app/stores/authStore';

import './ForgotPassword.css';
import { getEmailValidationError, normalizeEmail } from '@/app/lib/validators';
import { AuthShell, AuthBrandContent } from '@/app/features/marketing/site';

const scrollToTop = () => {
  if (globalThis.window) {
    globalThis.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

const BRAND_POINTS = [
  {
    icon: <IoShieldCheckmarkOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'One code, one reset. Your workspace stays yours.',
  },
  {
    icon: <IoGitBranchOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'A FHIR-native API and a codebase you can actually read.',
  },
  {
    icon: <IoLockClosedOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'Free to self-host. Your data never leaves your walls.',
  },
] as const;

const labelStyle = { display: 'flex', flexDirection: 'column', gap: 7 } as const;

const errorTextStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  color: '#d53225',
  letterSpacing: '-0.01em',
};

const primaryBtnStyle: React.CSSProperties = {
  marginTop: 4,
  width: '100%',
  boxSizing: 'border-box',
  fontSize: 16,
  padding: '16px 24px',
  borderRadius: 13,
  boxShadow: '0 14px 30px rgba(29,28,27,0.22)',
};

const ghostBtnStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  fontSize: 15,
  padding: '14px 20px',
  borderRadius: 13,
};

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-newsreader)',
  fontSize: 'clamp(30px, 3.2vw, 39px)',
  fontWeight: 400,
  lineHeight: 1.06,
  letterSpacing: '-0.03em',
  color: '#1d1c1b',
};

const subheadStyle: React.CSSProperties = {
  margin: '12px 0 0',
  fontSize: 15.5,
  lineHeight: 1.55,
  letterSpacing: '-0.01em',
  color: '#5c5956',
};

const ForgotPassword = () => {
  const router = useRouter();
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  const { forgotPassword, resetPassword } = useAuthStore();

  const [showVerifyCode, setShowVerifyCode] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const resetPasswordFormState = () => {
    setShowNewPassword(false);
    setPassword('');
    setConfirmPassword('');
    setOtp(['', '', '', '', '', '']);
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

  const handleOtp = async (e: React.MouseEvent<HTMLElement>) => {
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

  const handleVerifyOtp = async (e: React.MouseEvent<HTMLElement>) => {
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

  const handlePasswordChange = async (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();

    const passwordErrors = getPasswordValidationErrors();
    if (passwordErrors) {
      setInputErrors(passwordErrors);
      scrollToTop();
      showErrorTost({
        message:
          passwordErrors.confirmPassword === 'Passwords do not match'
            ? 'Passwords do not match'
            : 'Both Passwords are required',
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
          setShowVerifyCode(false);
          resetPasswordFormState();
        }, 5000);
      }
    } catch (error: any) {
      scrollToTop();
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
      resetPasswordFormState();
    }
  };

  const brand = (
    <AuthBrandContent
      eyebrow="Open-source operating system for animal health"
      title={
        <>
          Back in, in a{' '}
          <em style={{ fontStyle: 'italic', fontWeight: 500, color: '#8fb6f5' }}>minute.</em>
        </>
      }
      subtitle="Reset your password and pick up right where you left off. Your workspace, records, and every plugin are waiting."
      points={BRAND_POINTS}
    />
  );

  const topRight = (
    <>
      <span data-hide-s="true">Remembered it?</span>
      <Link href="/signin" className="yc-switch">
        Sign in
      </Link>
    </>
  );

  const renderEmailStep = () => (
    <div>
      <h1 style={headingStyle}>
        Forgot <em style={{ fontStyle: 'italic', fontWeight: 500, color: '#1657c9' }}>password?</em>
      </h1>
      <p style={{ ...subheadStyle, margin: '12px 0 26px' }}>
        Enter your registered email, and we&rsquo;ll send you a code to reset it.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <div style={labelStyle}>
          <label className="yc-lbl" htmlFor="forgot-email">
            Email address
          </label>
          <input
            id="forgot-email"
            name="email"
            className="yc-field"
            type="email"
            autoComplete="email"
            placeholder="you@clinic.com"
            aria-label="Email Address"
            aria-invalid={Boolean(inputErrors.email)}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setInputErrors((prev) => ({ ...prev, email: undefined }));
            }}
          />
          {inputErrors.email ? (
            <div role="alert" style={errorTextStyle}>
              <IoAlertCircleOutline style={{ fontSize: 17, flex: 'none' }} aria-hidden="true" />
              {inputErrors.email}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="yc-btn-primary"
          onClick={handleOtp}
          style={primaryBtnStyle}
        >
          Send code <IoArrowForwardOutline style={{ fontSize: 17 }} aria-hidden="true" />
        </button>
        <Link
          href="/signin"
          className="yc-btn-ghost"
          style={{ ...ghostBtnStyle, marginTop: 0, textAlign: 'center' }}
        >
          Back
        </Link>
      </div>
    </div>
  );

  const renderVerifyStep = () => (
    <div>
      <h1 style={headingStyle}>
        Verify <em style={{ fontStyle: 'italic', fontWeight: 500, color: '#1657c9' }}>code</em>
      </h1>
      <p style={{ ...subheadStyle, margin: '12px 0 26px' }}>
        Enter the code we just sent to your email to proceed with resetting your password.
      </p>
      <fieldset
        className="verifyInput"
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
      </fieldset>
      <p
        id={otpHintId}
        style={{ margin: '14px 0 0', fontSize: 13, color: '#8f8984', textAlign: 'center' }}
      >
        Enter the 6-digit code from your email.
      </p>
      {inputErrors.otp ? (
        <div
          id={otpErrorId}
          role="alert"
          style={{ ...errorTextStyle, justifyContent: 'center', marginTop: 8 }}
        >
          <IoAlertCircleOutline style={{ fontSize: 17, flex: 'none' }} aria-hidden="true" />
          <span>{inputErrors.otp}</span>
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          alignItems: 'center',
          width: '100%',
          marginTop: 20,
        }}
      >
        <button
          type="button"
          className="yc-btn-primary"
          onClick={handleVerifyOtp}
          style={primaryBtnStyle}
        >
          Verify code <IoArrowForwardOutline style={{ fontSize: 17 }} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="yc-btn-ghost"
          onClick={() => setShowVerifyCode(false)}
          style={ghostBtnStyle}
        >
          Back
        </button>
        <div style={{ fontSize: 13.5, color: '#5c5956', letterSpacing: '-0.01em' }}>
          Didn&apos;t receive the code?{' '}
          <Link
            href="#"
            onClick={handleOtp}
            style={{ color: '#1657c9', textDecoration: 'none', fontWeight: 600 }}
          >
            Request New Code
          </Link>
        </div>
      </div>
    </div>
  );

  const renderNewPasswordStep = () => (
    <div>
      <h1 style={headingStyle}>
        Set new <em style={{ fontStyle: 'italic', fontWeight: 500, color: '#1657c9' }}>password</em>
      </h1>
      <p style={{ ...subheadStyle, margin: '12px 0 26px' }}>
        Choose a new password for your workspace.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <div style={labelStyle}>
          <label className="yc-lbl" htmlFor="forgot-password">
            Enter new password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="forgot-password"
              name="password"
              className="yc-field"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              aria-label="Enter New Password"
              aria-invalid={Boolean(inputErrors.password)}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearPasswordErrors();
              }}
              style={{ paddingRight: 46 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 32,
                height: 32,
                border: 'none',
                background: 'transparent',
                color: '#8f8984',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {showPassword ? (
                <IoEyeOffOutline style={{ fontSize: 19 }} aria-hidden="true" />
              ) : (
                <IoEyeOutline style={{ fontSize: 19 }} aria-hidden="true" />
              )}
            </button>
          </div>
          {inputErrors.password ? (
            <div role="alert" style={errorTextStyle}>
              <IoAlertCircleOutline style={{ fontSize: 17, flex: 'none' }} aria-hidden="true" />
              {inputErrors.password}
            </div>
          ) : null}
        </div>
        <div style={labelStyle}>
          <label className="yc-lbl" htmlFor="forgot-confirm-password">
            Confirm password
          </label>
          <input
            id="forgot-confirm-password"
            name="confirmPassword"
            className="yc-field"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            aria-label="Confirm Password"
            aria-invalid={Boolean(inputErrors.confirmPassword)}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              clearPasswordErrors();
            }}
          />
          {inputErrors.confirmPassword ? (
            <div role="alert" style={errorTextStyle}>
              <IoAlertCircleOutline style={{ fontSize: 17, flex: 'none' }} aria-hidden="true" />
              {inputErrors.confirmPassword}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="yc-btn-primary"
          onClick={handlePasswordChange}
          style={primaryBtnStyle}
        >
          Reset password <IoArrowForwardOutline style={{ fontSize: 17 }} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="yc-btn-ghost"
          onClick={() => setShowNewPassword(false)}
          style={ghostBtnStyle}
        >
          Back
        </button>
      </div>
    </div>
  );

  let step: React.ReactNode;
  if (showNewPassword) {
    step = renderNewPasswordStep();
  } else if (showVerifyCode) {
    step = renderVerifyStep();
  } else {
    step = renderEmailStep();
  }

  return (
    <>
      {ErrorTostPopup}
      <AuthShell brand={brand} topRight={topRight}>
        <span
          aria-hidden="true"
          style={{
            width: 66,
            height: 66,
            borderRadius: 9999,
            background: '#e6f2ff',
            color: '#257bed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <IoMailOpenOutline style={{ fontSize: 31 }} />
        </span>
        {step}
      </AuthShell>
    </>
  );
};

export default ForgotPassword;
