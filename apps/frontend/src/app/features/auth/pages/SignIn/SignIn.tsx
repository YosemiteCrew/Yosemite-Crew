'use client';
import Link from 'next/link';
import React, { Suspense, useState } from 'react';
import { Icon } from '@/app/ui/icons/Icon';
import {
  IoCloudOfflineOutline,
  IoGitBranchOutline,
  IoShieldCheckmarkOutline,
} from 'react-icons/io5';

import { useErrorTost } from '@/app/ui/overlays/Toast/Toast';
import { useAuthStore } from '@/app/stores/authStore';
import OtpModal from '@/app/ui/overlays/OtpModal/OtpModal';
import { useRouter, useSearchParams } from 'next/navigation';
import { getEmailValidationError, normalizeEmail } from '@/app/lib/validators';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import { resolvePostAuthRedirect, sanitizeNextPath } from '@/app/lib/postAuthRedirect';
import { setStorageItem } from '@/app/lib/browserStorage';
import { resetSidebarPreference } from '@/app/lib/sidebarPreference';
import { AuthShell, AuthBrandContent } from '@/app/features/marketing/site';
import { GithubSignInButton } from '@/app/features/auth/pages/GithubSignInButton';
import {
  AuthForm,
  AuthHeading,
  AuthSubtitle,
  AuthTextField,
  AuthPasswordField,
  AuthSubmitButton,
  AuthAltNote,
} from '@/app/features/auth/pages/authForm';

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

type AccountType = 'business' | 'developer';

const ACCOUNT_TYPES: ReadonlyArray<{ value: AccountType; label: string }> = [
  { value: 'business', label: 'Pet business' },
  { value: 'developer', label: 'Developer' },
];

const ACCOUNT_TYPE_OPTION_STYLE: React.CSSProperties = {
  flex: 1,
  padding: '9px 12px',
  border: 'none',
  borderRadius: 9,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  transition: 'background 150ms ease, color 150ms ease',
};

/** Segmented control that lets the user pick which kind of account they are signing in to. */
const AccountTypeSelector = ({
  value,
  onChange,
}: Readonly<{ value: AccountType; onChange: (next: AccountType) => void }>) => (
  <div
    role="radiogroup"
    aria-label="Account type"
    style={{
      display: 'flex',
      gap: 4,
      padding: 4,
      marginBottom: 18,
      background: 'var(--inset)',
      borderRadius: 12,
    }}
  >
    {ACCOUNT_TYPES.map((option) => {
      const active = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(option.value)}
          style={{
            ...ACCOUNT_TYPE_OPTION_STYLE,
            background: active ? 'var(--screen)' : 'transparent',
            color: active ? 'var(--ink)' : 'var(--ink-muted)',
            boxShadow: active ? '0 1px 2px rgba(29, 28, 27, 0.08)' : 'none',
          }}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

const SignInForm = ({
  redirectPath,
  signupHref = '/signup',
  allowNext = true,
  isDeveloper: isDeveloperDefault = false,
}: Readonly<SignInProps>) => {
  const [accountType, setAccountType] = useState<AccountType>(
    isDeveloperDefault ? 'developer' : 'business'
  );
  const isDeveloper = accountType === 'developer';
  const { signIn, resendCode, role } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  const [email, setEmail] = useState(() => searchParams?.get('email') ?? '');
  const nextPath = allowNext ? sanitizeNextPath(searchParams?.get('next') ?? null) : undefined;
  const effectiveRedirectPath = redirectPath ?? nextPath;
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
      resetSidebarPreference();
      // Set devAuth flag BEFORE redirect so DevRouteGuard can read it
      setStorageItem('session', 'devAuth', isDeveloper ? 'true' : 'false');
      const signedInRole =
        typeof useAuthStore.getState === 'function' ? useAuthStore.getState().role : role;
      const nextRoute = await resolvePostAuthRedirect({
        fallbackRole: signedInRole,
        redirectPath: effectiveRedirectPath,
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
        <AuthHeading>
          {isDeveloper ? (
            'Sign in to your developer account'
          ) : (
            <>
              Welcome{' '}
              <em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--nav-active)' }}>
                back
              </em>
            </>
          )}
        </AuthHeading>
        <AuthSubtitle>Sign in to your clinic or developer workspace.</AuthSubtitle>
        <AccountTypeSelector value={accountType} onChange={setAccountType} />
        <AuthForm onSubmit={handleSignIn}>
          <AuthTextField
            id="signin-email"
            label="Work email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@clinic.com"
            ariaLabel="Work email"
            value={email}
            error={inputErrors.email}
            onChange={(value) => {
              setEmail(value);
              setInputErrors((prev) => ({ ...prev, email: undefined }));
            }}
          />
          <AuthPasswordField
            id="signin-password"
            label="Password"
            name="password"
            autoComplete="current-password"
            placeholder="Your password"
            ariaLabel="Password"
            value={password}
            error={inputErrors.pError}
            onChange={(value) => {
              setPassword(value);
              setInputErrors((prev) => ({ ...prev, pError: undefined }));
            }}
            showPassword={showPassword}
            onToggleShowPassword={() => setShowPassword((prev) => !prev)}
            labelAccessory={
              <Link
                href="/forgot-password"
                style={{
                  fontSize: 13,
                  color: 'var(--nav-active)',
                  textDecoration: 'none',
                  letterSpacing: '-0.01em',
                }}
              >
                Forgot password?
              </Link>
            }
          />
          <AuthSubmitButton idle="Sign in" busy="Signing in..." isSubmitting={isSubmitting} />
        </AuthForm>
        {isDeveloper ? (
          <GithubSignInButton note="GitHub is available for developer accounts." />
        ) : null}
        <AuthAltNote>
          Pet parent? Sign in from the{' '}
          <Link
            href="/pet-parents"
            style={{ color: 'var(--nav-active)', textDecoration: 'none', fontWeight: 600 }}
          >
            mobile app
          </Link>
          .
        </AuthAltNote>
      </AuthShell>
      <OtpModal
        email={normalizeEmail(email)}
        password={password}
        showErrorTost={showErrorTost}
        showVerifyModal={showVerifyModal}
        setShowVerifyModal={setShowVerifyModal}
        redirectPath={effectiveRedirectPath}
        isDeveloper={isDeveloper}
      />
    </>
  );
};

// useSearchParams needs a Suspense boundary; owning it here keeps every
// consumer of SignIn safe regardless of how the route wraps it.
const SignIn = (props: Readonly<SignInProps>) => (
  <Suspense fallback={null}>
    <SignInForm {...props} />
  </Suspense>
);

export default SignIn;
