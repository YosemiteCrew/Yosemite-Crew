'use client';
import Link from 'next/link';
import React, { useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import {
  IoAlertCircleOutline,
  IoArrowForwardOutline,
  IoCloudOfflineOutline,
  IoEyeOffOutline,
  IoEyeOutline,
  IoGitBranchOutline,
  IoPhonePortraitOutline,
  IoShieldCheckmarkOutline,
} from 'react-icons/io5';

import { useErrorTost } from '@/app/ui/overlays/Toast/Toast';
import { useAuthStore } from '@/app/stores/authStore';
import OtpModal from '@/app/ui/overlays/OtpModal/OtpModal';
import { useRouter } from 'next/navigation';
import { getEmailValidationError, normalizeEmail } from '@/app/lib/validators';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';
import { setStorageItem } from '@/app/lib/browserStorage';
import { defaultSidebarToCollapsed } from '@/app/lib/sidebarPreference';
import { AuthShell, AuthBrandContent } from '@/app/features/marketing/site';
import { GithubSignInButton } from '@/app/features/auth/pages/GithubSignInButton';

type SignInProps = {
  redirectPath?: string;
  signupHref?: string;
  allowNext?: boolean;
  isDeveloper?: boolean;
};

const CLINIC_POINTS = [
  {
    icon: <IoCloudOfflineOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'Works on the worst afternoon. Even offline.',
  },
  {
    icon: <IoGitBranchOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'A FHIR-native API and a codebase you can actually read.',
  },
  {
    icon: <IoShieldCheckmarkOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'Free to self-host. Your data never leaves your walls.',
  },
] as const;

const DEV_POINTS = [
  {
    icon: <IoGitBranchOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'Open source. Read it, run it locally, send a PR.',
  },
  {
    icon: <IoShieldCheckmarkOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'A FHIR-native API and a codebase you can actually read.',
  },
  {
    icon: <IoCloudOfflineOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'Free to self-host. Your data never leaves your walls.',
  },
] as const;

const SignIn = ({
  redirectPath,
  signupHref = '/signup',
  isDeveloper = false,
}: Readonly<SignInProps>) => {
  const { signIn, resendCode, role } = useAuthStore();
  const router = useRouter();
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [inputErrors, setInputErrors] = useState<{
    email?: string;
    pError?: string;
  }>({});

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCodeResendonError = async () => {
    try {
      const result = await resendCode(normalizeEmail(email));
      if (result) {
        setShowVerifyModal(true);
      }
    } catch (error: any) {
      globalThis.window?.scrollTo({ top: 0, behavior: 'smooth' });
      showErrorTost({
        message: error.message || 'Error resending code.',
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

  const handleSignIn = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    const errors: { email?: string; pError?: string } = {};
    const normalizedEmail = normalizeEmail(email);
    const emailError = getEmailValidationError(normalizedEmail);
    if (emailError) errors.email = emailError;
    if (!password) errors.pError = 'Password is required';
    setInputErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      await signIn(normalizedEmail, password);
      defaultSidebarToCollapsed();
      // Set devAuth flag BEFORE redirect so DevRouteGuard can read it
      setStorageItem('session', 'devAuth', isDeveloper ? 'true' : 'false');
      const signedInRole =
        typeof useAuthStore.getState === 'function' ? useAuthStore.getState().role : role;
      const nextRoute = await resolvePostAuthRedirect({
        fallbackRole: signedInRole,
        redirectPath,
        isDeveloper,
      });
      router.replace(nextRoute);
    } catch (error: any) {
      setIsSubmitting(false);
      if (error?.code === 'UserNotConfirmedException') {
        await handleCodeResendonError();
      } else {
        showErrorTost({
          message: error.message || `Sign in failed`,
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
    }
  };

  const brand = (
    <AuthBrandContent
      eyebrow={
        isDeveloper
          ? 'Open-source developer platform'
          : 'Open-source operating system for animal health'
      }
      title={
        isDeveloper ? (
          <>
            Pick up where you{' '}
            <em style={{ fontStyle: 'italic', fontWeight: 500, color: '#5ce1e6' }}>left off.</em>
          </>
        ) : (
          <>
            Pick up where your{' '}
            <em style={{ fontStyle: 'italic', fontWeight: 500, color: '#8fb6f5' }}>clinic</em> left
            off.
          </>
        )
      }
      subtitle="One login for the whole workspace, appointments, records, billing, and every plugin your team has installed."
      points={isDeveloper ? DEV_POINTS : CLINIC_POINTS}
    />
  );

  const topRight = (
    <>
      <span data-hide-s="true">New to Yosemite Crew?</span>
      <Link href={signupHref} className="yc-switch">
        Sign up
      </Link>
    </>
  );

  return (
    <>
      {isSubmitting ? (
        <YosemiteLoader
          variant="fullscreen-translucent"
          label="Signing you in..."
          testId="signin-loader"
        />
      ) : null}
      {ErrorTostPopup}
      <AuthShell brand={brand} topRight={topRight}>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-newsreader)',
            fontSize: 'clamp(30px, 3.2vw, 39px)',
            fontWeight: 400,
            lineHeight: 1.06,
            letterSpacing: '-0.03em',
            color: '#1d1c1b',
          }}
        >
          {isDeveloper ? (
            'Sign in to your developer account'
          ) : (
            <>
              Welcome{' '}
              <em style={{ fontStyle: 'italic', fontWeight: 500, color: '#1657c9' }}>back</em>
            </>
          )}
        </h1>
        <p
          style={{
            margin: '12px 0 26px',
            fontSize: 15.5,
            lineHeight: 1.55,
            letterSpacing: '-0.01em',
            color: '#5c5956',
          }}
        >
          Sign in to your clinic or developer workspace.
        </p>
        <form
          onSubmit={handleSignIn}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 15 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label className="yc-lbl" htmlFor="signin-email">
              Work email
            </label>
            <input
              id="signin-email"
              name="email"
              className="yc-field"
              type="email"
              autoComplete="email"
              placeholder="you@clinic.com"
              aria-label="Work email"
              aria-invalid={Boolean(inputErrors.email)}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setInputErrors((prev) => ({ ...prev, email: undefined }));
              }}
            />
            {inputErrors.email ? (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  color: '#d53225',
                  letterSpacing: '-0.01em',
                }}
              >
                <IoAlertCircleOutline style={{ fontSize: 17, flex: 'none' }} aria-hidden="true" />
                {inputErrors.email}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="yc-lbl" htmlFor="signin-password">
                Password
              </label>
              <Link
                href="/forgot-password"
                style={{
                  fontSize: 13,
                  color: '#1657c9',
                  textDecoration: 'none',
                  letterSpacing: '-0.01em',
                }}
              >
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="signin-password"
                name="password"
                className="yc-field"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Your password"
                aria-label="Password"
                aria-invalid={Boolean(inputErrors.pError)}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setInputErrors((prev) => ({ ...prev, pError: undefined }));
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
            {inputErrors.pError ? (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  color: '#d53225',
                  letterSpacing: '-0.01em',
                }}
              >
                <IoAlertCircleOutline style={{ fontSize: 17, flex: 'none' }} aria-hidden="true" />
                {inputErrors.pError}
              </div>
            ) : null}
          </div>
          <button
            type="submit"
            className="yc-btn-primary"
            disabled={isSubmitting}
            style={{
              marginTop: 4,
              width: '100%',
              boxSizing: 'border-box',
              fontSize: 16,
              padding: '16px 24px',
              borderRadius: 13,
              boxShadow: '0 14px 30px rgba(29,28,27,0.22)',
            }}
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
            <IoArrowForwardOutline style={{ fontSize: 17 }} aria-hidden="true" />
          </button>
        </form>
        <GithubSignInButton note="GitHub is available for developer accounts." />
        <div
          style={{
            marginTop: 22,
            paddingTop: 18,
            borderTop: '1px solid #e5dccf',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            justifyContent: 'center',
            textAlign: 'center',
            fontSize: 13.5,
            lineHeight: 1.5,
            color: '#8f8984',
            letterSpacing: '-0.01em',
          }}
        >
          <IoPhonePortraitOutline
            style={{ fontSize: 17, flex: 'none', color: '#a9a39e' }}
            aria-hidden="true"
          />
          <span>
            Pet parent? Sign in from the{' '}
            <Link
              href="/pet-parents"
              style={{ color: '#1657c9', textDecoration: 'none', fontWeight: 600 }}
            >
              mobile app
            </Link>
            .
          </span>
        </div>
      </AuthShell>
      <OtpModal
        email={normalizeEmail(email)}
        password={password}
        showErrorTost={showErrorTost}
        showVerifyModal={showVerifyModal}
        setShowVerifyModal={setShowVerifyModal}
        redirectPath={redirectPath}
        isDeveloper={isDeveloper}
      />
    </>
  );
};

export default SignIn;
