'use client';
import { useState, type CSSProperties, type SyntheticEvent } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react/dist/iconify.js';
import {
  IoMailOutline,
  IoKeyOutline,
  IoShieldCheckmarkOutline,
  IoCheckmarkCircleOutline,
} from 'react-icons/io5';

import { useErrorTost } from '@/app/ui/overlays/Toast/Toast';
import { useAuthStore } from '@/app/stores/authStore';
import { getEmailValidationError, normalizeEmail } from '@/app/lib/validators';
import { AuthShell, AuthBrandContent } from '@/app/features/marketing/site';
import {
  AuthForm,
  AuthHeading,
  AuthSubtitle,
  AuthTextField,
  AuthSubmitButton,
  AuthAltNote,
} from '@/app/features/auth/pages/authForm';

const RESET_POINTS = [
  {
    icon: <IoMailOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'We email you a secure link, never your password.',
  },
  {
    icon: <IoKeyOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'The link lets you set a fresh password in seconds.',
  },
  {
    icon: <IoShieldCheckmarkOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'It expires quickly, so only you can use it.',
  },
] as const;

const CONFIRM_BADGE_STYLE: CSSProperties = {
  display: 'inline-flex',
  width: 52,
  height: 52,
  borderRadius: 9999,
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--success-soft, #e7f4ec)',
  color: 'var(--success, #2f9e63)',
  marginBottom: 18,
};

const RETRY_BUTTON_STYLE: CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  font: 'inherit',
  color: 'var(--nav-active)',
  fontWeight: 600,
  cursor: 'pointer',
};

const LINK_STYLE: CSSProperties = {
  color: 'var(--nav-active)',
  textDecoration: 'none',
  fontWeight: 600,
};

const TOP_RIGHT = (
  <>
    <span data-hide-s="true">Remembered it?</span>
    <Link href="/signin" className="yc-switch">
      Sign in
    </Link>
  </>
);

/**
 * Step one of the SuperTokens password reset: collect the email and trigger the
 * reset link. SuperTokens emails a tokenized link that lands on /reset-password,
 * where the new password is actually set - so this page never asks for a code or
 * a new password itself.
 */
const ForgotPassword = () => {
  const forgotPassword = useAuthStore((s) => s.forgotPassword);
  const { showErrorTost, ErrorTostPopup } = useErrorTost();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalized = normalizeEmail(email);
    const validationError = getEmailValidationError(normalized);
    if (validationError) {
      setEmailError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      await forgotPassword(normalized);
      // sendPasswordResetEmail resolves OK even when the address is unknown, so
      // the confirmation is deliberately neutral (no account-existence leak).
      setSentTo(normalized);
    } catch (error) {
      // PASSWORD_RESET_NOT_ALLOWED is SuperTokens' account-takeover protection; its
      // reason must never be surfaced, or it leaks account state. Treat it exactly
      // like a successful send so the outcome is indistinguishable to an attacker.
      if ((error as { code?: string })?.code === 'PASSWORD_RESET_NOT_ALLOWED') {
        setSentTo(normalized);
        return;
      }
      setIsSubmitting(false);
      showErrorTost({
        message:
          error instanceof Error
            ? error.message
            : 'We could not send the reset email. Please try again.',
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
          Back in,{' '}
          <em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--nav-active)' }}>
            safely.
          </em>
        </>
      }
      subtitle="Forgot your password? It happens. We will email you a secure link to set a new one."
      points={RESET_POINTS}
    />
  );

  return (
    <>
      {ErrorTostPopup}
      <AuthShell brand={brand} topRight={TOP_RIGHT}>
        {sentTo ? (
          <div data-testid="forgot-sent">
            <span style={CONFIRM_BADGE_STYLE}>
              <IoCheckmarkCircleOutline style={{ fontSize: 28 }} aria-hidden="true" />
            </span>
            <AuthHeading>Check your email</AuthHeading>
            <AuthSubtitle>
              If an account exists for <strong>{sentTo}</strong>, we have sent a link to reset your
              password. It expires soon, so use it while it is fresh.
            </AuthSubtitle>
            <AuthAltNote>
              Did not get it? Check spam, or{' '}
              <button
                type="button"
                onClick={() => {
                  setSentTo(null);
                  setIsSubmitting(false);
                }}
                style={RETRY_BUTTON_STYLE}
              >
                try another email
              </button>
              {'.'}
            </AuthAltNote>
          </div>
        ) : (
          <>
            <AuthHeading>
              Reset your{' '}
              <em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--nav-active)' }}>
                password
              </em>
            </AuthHeading>
            <AuthSubtitle>
              Enter the email you sign in with and we will send you a reset link.
            </AuthSubtitle>
            <AuthForm onSubmit={handleSubmit}>
              <AuthTextField
                id="forgot-email"
                label="Work email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@clinic.com"
                ariaLabel="Work email"
                value={email}
                error={emailError}
                onChange={(value) => {
                  setEmail(value);
                  setEmailError(undefined);
                }}
              />
              <AuthSubmitButton
                idle="Send reset link"
                busy="Sending..."
                isSubmitting={isSubmitting}
              />
            </AuthForm>
            <AuthAltNote>
              Remembered your password?{' '}
              <Link href="/signin" style={LINK_STYLE}>
                Back to sign in
              </Link>
            </AuthAltNote>
          </>
        )}
      </AuthShell>
    </>
  );
};

export default ForgotPassword;
