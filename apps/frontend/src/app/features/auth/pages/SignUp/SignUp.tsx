'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react/dist/iconify.js';
import {
  IoAlertCircleOutline,
  IoArrowForwardOutline,
  IoCalendarOutline,
  IoCheckmark,
  IoCodeSlashOutline,
  IoExtensionPuzzleOutline,
  IoEyeOffOutline,
  IoEyeOutline,
  IoGitBranchOutline,
  IoPhonePortraitOutline,
  IoShieldCheckmarkOutline,
} from 'react-icons/io5';

import { useErrorTost } from '@/app/ui/overlays/Toast/Toast';
import { useAuthStore } from '@/app/stores/authStore';
import OtpModal from '@/app/ui/overlays/OtpModal/OtpModal';
import { getEmailValidationError, normalizeEmail } from '@/app/lib/validators';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import { useSignUpDraft } from '@/app/hooks/useSignUpDraft';
import { setStorageItem } from '@/app/lib/browserStorage';
import { defaultSidebarToCollapsed } from '@/app/lib/sidebarPreference';
import { AuthShell, AuthBrandContent } from '@/app/features/marketing/site';
import { GithubSignInButton } from '@/app/features/auth/pages/GithubSignInButton';

const CLINIC_ROLE = 'A veterinary clinic, practice, or hospital';
const DEVELOPER_ROLE = 'A developer';

const CLINIC_POINTS = [
  {
    icon: <IoCalendarOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'Appointments, records, and billing on one screen.',
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
    icon: <IoCodeSlashOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'REST and FHIR APIs, typed SDKs, and webhooks.',
  },
  {
    icon: <IoGitBranchOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'Open source. Read it, run it locally, send a PR.',
  },
  {
    icon: <IoExtensionPuzzleOutline style={{ fontSize: 19 }} aria-hidden="true" />,
    text: 'Ship plugins to the marketplace. Reach every clinic.',
  },
] as const;

const errorTextStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  color: '#d53225',
  letterSpacing: '-0.01em',
};

const passwordErrors = (
  password: string,
  confirmPassword: string
): { pError?: string; confirmPError?: string } => {
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

  if (!password) {
    return {
      pError: 'Password is required',
      ...(confirmPassword ? {} : { confirmPError: 'Confirm Password is required' }),
    };
  }

  if (!strongPasswordRegex.test(password)) {
    return {
      pError:
        'Password must be at least 8 characters long, include uppercase, lowercase, number, and special character',
    };
  }

  if (!confirmPassword) {
    return { confirmPError: 'Confirm Password is required' };
  }

  if (password !== confirmPassword) {
    return { confirmPError: 'Passwords do not match' };
  }

  return {};
};

const validateSignUpInputs = (
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  confirmPassword: string,
  agree: boolean
) => {
  const errors: {
    firstName?: string;
    lastName?: string;
    email?: string;
    pError?: string;
    confirmPError?: string;
    agree?: string;
  } = {};

  if (!firstName) errors.firstName = 'First name is required';
  if (!lastName) errors.lastName = 'Last name is required';
  const emailError = getEmailValidationError(email);
  if (emailError) errors.email = emailError;

  Object.assign(errors, passwordErrors(password, confirmPassword));

  if (!agree) {
    errors.agree = 'Please check the Terms and Conditions box';
  }

  return errors;
};

type SignUpProps = {
  postAuthRedirect?: string;
  signinHref?: string;
  allowNext?: boolean;
  isDeveloper?: boolean;
};

type FieldErrorProps = { message?: string };

const FieldError = ({ message }: Readonly<FieldErrorProps>) =>
  message ? (
    <div role="alert" style={errorTextStyle}>
      <IoAlertCircleOutline style={{ fontSize: 17, flex: 'none' }} aria-hidden="true" />
      {message}
    </div>
  ) : null;

const SignUp = ({
  postAuthRedirect,
  signinHref = '/signin',
  isDeveloper = false,
}: Readonly<SignUpProps>) => {
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  const { signUp } = useAuthStore();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [role, setRole] = useState(isDeveloper ? DEVELOPER_ROLE : CLINIC_ROLE);

  const effectiveDeveloper = isDeveloper || role === DEVELOPER_ROLE;

  const { clearSignUpDraft } = useSignUpDraft({
    firstName,
    lastName,
    email,
    setFirstName,
    setLastName,
    setEmail,
  });

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [inputErrors, setInputErrors] = useState<{
    confirmPError?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    pError?: string;
    agree?: string;
  }>({});

  const handleSignupSuccess = () => {
    defaultSidebarToCollapsed();
    clearSignUpDraft();
    globalThis.window?.scrollTo({ top: 0, behavior: 'smooth' });
    setStorageItem('session', 'devAuth', effectiveDeveloper ? 'true' : 'false');
    setIsSubmitting(false);
    setShowVerifyModal(true);
  };

  const handleSignupError = (error: any) => {
    if (typeof globalThis !== 'undefined') {
      globalThis.window?.scrollTo({ top: 0, behavior: 'smooth' });
    }
    const status = error.code === 'UsernameExistsException' ? 409 : undefined;
    const message = error.message || 'Something went wrong.';

    showErrorTost({
      message,
      errortext: status === 409 ? 'Already Registered' : 'Signup Error',
      iconElement: <Icon icon="mdi:error" width="20" height="20" color="var(--color-danger-600)" />,
      className: status === 409 ? 'errofoundbg' : 'oppsbg',
    });
    setIsSubmitting(false);
    setShowVerifyModal(false);
  };

  const handleSignUp = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    const errors = validateSignUpInputs(
      firstName,
      lastName,
      normalizedEmail,
      password,
      confirmPassword,
      agree
    );

    setInputErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      const args: Parameters<typeof signUp> = effectiveDeveloper
        ? [normalizedEmail, password, firstName, lastName, 'developer']
        : [normalizedEmail, password, firstName, lastName];

      const result = await signUp(...args);

      if (result) {
        handleSignupSuccess();
      }
    } catch (error: any) {
      handleSignupError(error);
    }
  };

  const brand = (
    <AuthBrandContent
      eyebrow={
        effectiveDeveloper
          ? 'Open-source developer platform'
          : 'Open-source operating system for animal health'
      }
      title={
        effectiveDeveloper ? (
          <>
            Build it in{' '}
            <em style={{ fontStyle: 'italic', fontWeight: 500, color: '#5ce1e6' }}>
              an afternoon.
            </em>
          </>
        ) : (
          <>
            See the{' '}
            <em style={{ fontStyle: 'italic', fontWeight: 500, color: '#8fb6f5' }}>whole</em>{' '}
            animal.
          </>
        )
      }
      subtitle={
        effectiveDeveloper
          ? 'A FHIR-native API, a plugin system, and a codebase you can actually read. Publish once and reach every clinic running Yosemite Crew.'
          : 'The operating system veterinary clinics run on, and the platform developers build on. Free to self-host, and yours to own.'
      }
      points={effectiveDeveloper ? DEV_POINTS : CLINIC_POINTS}
    />
  );

  const topRight = (
    <>
      <span data-hide-s="true">Already have an account?</span>
      <Link href={signinHref} className="yc-switch">
        Sign in
      </Link>
    </>
  );

  return (
    <>
      {isSubmitting ? (
        <YosemiteLoader
          variant="fullscreen-translucent"
          label="Creating your account..."
          testId="signup-loader"
        />
      ) : null}
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
          Create your{' '}
          <em style={{ fontStyle: 'italic', fontWeight: 500, color: '#1657c9' }}>account</em>
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
          For clinics and developers. Free to self-host, no card required.
        </p>
        <form
          onSubmit={handleSignUp}
          method="post"
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 15 }}
        >
          {!isDeveloper ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label className="yc-lbl" htmlFor="signup-role">
                I am
              </label>
              <select
                id="signup-role"
                className="yc-field"
                aria-label="I am"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value={CLINIC_ROLE}>{CLINIC_ROLE}</option>
                <option value={DEVELOPER_ROLE}>{DEVELOPER_ROLE}</option>
              </select>
            </div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label className="yc-lbl" htmlFor="signup-firstname">
              First name
            </label>
            <input
              id="signup-firstname"
              name="first name"
              className="yc-field"
              type="text"
              autoComplete="given-name"
              placeholder="Dr. Lena"
              aria-label="First name"
              aria-invalid={Boolean(inputErrors.firstName)}
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setInputErrors((prev) => ({ ...prev, firstName: undefined }));
              }}
            />
            <FieldError message={inputErrors.firstName} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label className="yc-lbl" htmlFor="signup-lastname">
              Last name
            </label>
            <input
              id="signup-lastname"
              name="last name"
              className="yc-field"
              type="text"
              autoComplete="family-name"
              placeholder="Weber"
              aria-label="Last name"
              aria-invalid={Boolean(inputErrors.lastName)}
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setInputErrors((prev) => ({ ...prev, lastName: undefined }));
              }}
            />
            <FieldError message={inputErrors.lastName} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label className="yc-lbl" htmlFor="signup-email">
              Work email
            </label>
            <input
              id="signup-email"
              name="email"
              className="yc-field"
              type="email"
              autoComplete="email"
              placeholder="you@clinic.com"
              aria-label="Enter email"
              aria-invalid={Boolean(inputErrors.email)}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setInputErrors((prev) => ({ ...prev, email: undefined }));
              }}
            />
            <FieldError message={inputErrors.email} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label className="yc-lbl" htmlFor="signup-password">
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="signup-password"
                name="password"
                className="yc-field"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                aria-label="Set up password"
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
            <FieldError message={inputErrors.pError} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label className="yc-lbl" htmlFor="signup-confirm-password">
              Confirm password
            </label>
            <input
              id="signup-confirm-password"
              name="confirm-password"
              className="yc-field"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              aria-label="Confirm password"
              aria-invalid={Boolean(inputErrors.confirmPError)}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setInputErrors((prev) => ({ ...prev, confirmPError: undefined }));
              }}
            />
            <FieldError message={inputErrors.confirmPError} />
          </div>
          <label
            style={{
              display: 'flex',
              gap: 11,
              alignItems: 'flex-start',
              cursor: 'pointer',
              marginTop: 3,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'relative',
                flex: 'none',
                width: 20,
                height: 20,
                marginTop: 1,
                border: `1.5px solid ${agree ? '#257bed' : '#d6d1cd'}`,
                borderRadius: 6,
                background: agree ? '#257bed' : '#fdfbf6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 150ms, border-color 150ms',
              }}
            >
              {agree ? <IoCheckmark style={{ fontSize: 14, color: '#fff' }} /> : null}
            </span>
            <input
              type="checkbox"
              checked={agree}
              aria-label="I agree to the terms and conditions and privacy policy"
              onChange={(e) => {
                setAgree(e.target.checked);
                setInputErrors((prev) => ({ ...prev, agree: undefined }));
              }}
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            />
            <span
              style={{
                fontSize: 13.5,
                lineHeight: 1.5,
                color: '#5c5956',
                letterSpacing: '-0.01em',
              }}
            >
              I agree to the{' '}
              <Link
                href="/terms-and-conditions?ref=signup"
                style={{ color: '#1657c9', textDecoration: 'none' }}
              >
                Terms
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy-policy?ref=signup"
                style={{ color: '#1657c9', textDecoration: 'none' }}
              >
                Privacy policy
              </Link>
              .
            </span>
          </label>
          <FieldError message={inputErrors.agree} />
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
            {isSubmitting ? 'Creating account...' : 'Create account'}
            <IoArrowForwardOutline style={{ fontSize: 17 }} aria-hidden="true" />
          </button>
        </form>
        {effectiveDeveloper ? <GithubSignInButton /> : null}
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
            Pet parent? Your account lives in the{' '}
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
        redirectPath={postAuthRedirect}
        isDeveloper={effectiveDeveloper}
      />
      {ErrorTostPopup}
    </>
  );
};

export default SignUp;
