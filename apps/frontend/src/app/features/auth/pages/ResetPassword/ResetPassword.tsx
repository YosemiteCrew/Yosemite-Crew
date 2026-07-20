'use client';
import { useState, type CSSProperties, type SyntheticEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import {
  IoLockClosedOutline,
  IoShieldCheckmarkOutline,
  IoTimeOutline,
  IoAlertCircleOutline,
} from 'react-icons/io5';

import { useErrorTost } from '@/app/ui/overlays/Toast/Toast';
import { useAuthStore } from '@/app/stores/authStore';
import { AuthShell, AuthBrandContent } from '@/app/features/marketing/site';
import {
  AuthForm,
  AuthHeading,
  AuthSubtitle,
  AuthPasswordField,
  AuthSubmitButton,
} from '@/app/features/auth/pages/authForm';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

const RESET_POINTS = [
  {
    icon: <IoLockClosedOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'Your new password is set over an encrypted connection.',
  },
  {
    icon: <IoShieldCheckmarkOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'Strong passwords keep your clinic and records safe.',
  },
  {
    icon: <IoTimeOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'This link works once, then it is gone.',
  },
] as const;

const BADGE_STYLE: CSSProperties = {
  display: 'inline-flex',
  width: 52,
  height: 52,
  borderRadius: 9999,
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--danger-bg)',
  color: 'var(--danger-text)',
  marginBottom: 18,
};

const BUTTON_COLUMN_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  marginTop: 4,
};

const BUTTON_LINK_STYLE: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  textAlign: 'center',
  fontSize: 15,
  padding: '14px 22px',
  borderRadius: 13,
  textDecoration: 'none',
};

const TOP_RIGHT = (
  <>
    <span data-hide-s="true">Know your password?</span>
    <Link href="/signin" className="yc-switch">
      Sign in
    </Link>
  </>
);

type PasswordErrors = {
  password?: string;
  confirmPassword?: string;
};

const getPasswordValidationErrors = (
  password: string,
  confirmPassword: string
): PasswordErrors | null => {
  if (!password) {
    return {
      password: 'Enter a new password',
      ...(confirmPassword ? {} : { confirmPassword: 'Confirm your new password' }),
    };
  }
  if (!STRONG_PASSWORD_REGEX.test(password)) {
    return {
      password:
        'Password must be at least 8 characters long, include uppercase, lowercase, number, and special character',
    };
  }
  if (!confirmPassword) {
    return { confirmPassword: 'Confirm your new password' };
  }
  if (password !== confirmPassword) {
    return { confirmPassword: 'Passwords do not match' };
  }
  return null;
};

/**
 * Landing page for the emailed password reset link. SuperTokens appends the
 * reset token to the URL; submitNewPassword (via authStore.resetPassword) reads
 * it from there, so this page only collects and confirms the new password.
 */
const ResetPassword = () => {
  const router = useRouter();
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [inputErrors, setInputErrors] = useState<PasswordErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const errors = getPasswordValidationErrors(password, confirmPassword);
    if (errors) {
      setInputErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      await resetPassword(password);
      showErrorTost({
        message: 'Password changed successfully. You can now sign in.',
        errortext: 'Success',
        iconElement: (
          <Icon
            icon="solar:check-circle-bold"
            width="20"
            height="20"
            color="var(--color-success-bright)"
          />
        ),
        className: 'CongratsBg',
      });
      setTimeout(() => {
        router.push('/signin');
      }, 2000);
    } catch (error: unknown) {
      setIsSubmitting(false);
      const code = (error as { code?: string })?.code;
      if (code === 'RESET_PASSWORD_INVALID_TOKEN_ERROR') {
        setLinkInvalid(true);
        return;
      }
      showErrorTost({
        message: error instanceof Error ? error.message : 'Something went wrong',
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

  const brand = (
    <AuthBrandContent
      eyebrow="Account recovery"
      title={
        <>
          Almost{' '}
          <em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--nav-active)' }}>
            done.
          </em>
        </>
      }
      subtitle="Set a new password and you are back in, on every device."
      points={RESET_POINTS}
    />
  );

  return (
    <>
      {ErrorTostPopup}
      <AuthShell brand={brand} topRight={TOP_RIGHT}>
        {linkInvalid ? (
          <div data-testid="reset-invalid">
            <span style={BADGE_STYLE}>
              <IoAlertCircleOutline style={{ fontSize: 28 }} aria-hidden="true" />
            </span>
            <AuthHeading>Reset link expired</AuthHeading>
            <AuthSubtitle>
              This password reset link is invalid or has expired. Request a new one to continue.
            </AuthSubtitle>
            <div style={BUTTON_COLUMN_STYLE}>
              <Link href="/forgot-password" className="yc-btn-primary" style={BUTTON_LINK_STYLE}>
                Request new link
              </Link>
              <Link href="/signin" className="yc-btn-ghost" style={BUTTON_LINK_STYLE}>
                Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <>
            <AuthHeading>
              Set a new{' '}
              <em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--nav-active)' }}>
                password
              </em>
            </AuthHeading>
            <AuthSubtitle>Choose a strong password you have not used here before.</AuthSubtitle>
            <AuthForm onSubmit={handleSubmit}>
              <AuthPasswordField
                id="reset-password"
                label="New password"
                name="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                ariaLabel="New password"
                value={password}
                error={inputErrors.password}
                showPassword={showPassword}
                onToggleShowPassword={() => setShowPassword((prev) => !prev)}
                onChange={(value) => {
                  setPassword(value);
                  setInputErrors({});
                }}
              />
              <AuthPasswordField
                id="reset-confirm"
                label="Confirm password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Re-enter your password"
                ariaLabel="Confirm password"
                value={confirmPassword}
                error={inputErrors.confirmPassword}
                showPassword={showConfirm}
                onToggleShowPassword={() => setShowConfirm((prev) => !prev)}
                onChange={(value) => {
                  setConfirmPassword(value);
                  setInputErrors({});
                }}
              />
              <AuthSubmitButton
                idle="Reset password"
                busy="Resetting..."
                isSubmitting={isSubmitting}
              />
            </AuthForm>
          </>
        )}
      </AuthShell>
    </>
  );
};

export default ResetPassword;
