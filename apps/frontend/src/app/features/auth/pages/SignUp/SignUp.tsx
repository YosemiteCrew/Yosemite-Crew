'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { GoCheckCircleFill } from 'react-icons/go';
import { Icon } from '@iconify/react/dist/iconify.js';

import { useErrorTost } from '@/app/ui/overlays/Toast/Toast';
import { useAuthStore } from '@/app/stores/authStore';
import OtpModal from '@/app/ui/overlays/OtpModal/OtpModal';

import FormInputPass from '@/app/ui/inputs/FormInputPass/FormInputPass';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import { Primary } from '@/app/ui/primitives/Buttons';
import { IoIosWarning } from 'react-icons/io';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { getEmailValidationError, normalizeEmail } from '@/app/lib/validators';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import { useSignUpDraft } from '@/app/hooks/useSignUpDraft';
import { setStorageItem } from '@/app/lib/browserStorage';
import { defaultSidebarToCollapsed } from '@/app/lib/sidebarPreference';

import '../AuthPages.css';

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
  const [agree, setAgree] = useState(false);

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
    setStorageItem('session', 'devAuth', isDeveloper ? 'true' : 'false');
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
      const args: Parameters<typeof signUp> = isDeveloper
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

  return (
    <section
      className={`
        relative flex w-full flex-1 min-h-screen items-center justify-center
        bg-cover bg-center bg-no-repeat
      `}
      style={{ backgroundImage: `url(${MEDIA_SOURCES.auth.background})` }}
    >
      {isSubmitting ? (
        <YosemiteLoader
          variant="fullscreen-translucent"
          label="Creating your account..."
          testId="signup-loader"
        />
      ) : null}
      <div className="flex gap-10 xl:gap-20 w-full md:max-w-[900px] mx-3 py-3 sm:mx-12 md:flex-row flex-col items-center md:items-start">
        <div className="flex align-center justify-center flex-col gap-8 w-[90%] sm:w-[70%] md:w-1/2 md:mt-16">
          <div className="flex w-full items-center justify-center">
            <p className="text-display-2 text-text-primary text-center max-w-87.5 auth-title">
              {isDeveloper
                ? 'Build, test, and ship apps on Yosemite Crew'
                : 'Built for everyone, from day one'}
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex gap-2">
              <div className="w-[20px]">
                <GoCheckCircleFill
                  color="var(--color-primary-500)"
                  size={20}
                  className="mt-[3px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-body-3-emphasis text-text-primary auth-feature-title">
                  {isDeveloper
                    ? 'API-first, self-host or managed'
                    : 'Enjoy smooth online solutions with us!'}
                </div>
                <p className="text-caption-1 text-text-primary auth-feature-desc">
                  {isDeveloper
                    ? 'Open source core with APIs built for integrations. Run it yourself or use our managed stack.'
                    : 'Our services are built on a strong foundation for great performance and flexibility.'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="w-[20px]">
                <GoCheckCircleFill
                  color="var(--color-primary-500)"
                  size={20}
                  className="mt-[3px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-body-3-emphasis text-text-primary auth-feature-title">
                  {isDeveloper
                    ? 'Local dev + production ready'
                    : 'Start free and upgrade as needed.'}
                </div>
                <p className="text-caption-1 text-text-primary auth-feature-desc">
                  {isDeveloper
                    ? 'Develop locally against the same APIs you deploy. No lock-in between self-hosted and hosted.'
                    : 'Enjoy generous free usage. Upgrade only when you need.'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="w-[20px]">
                <GoCheckCircleFill
                  color="var(--color-primary-500)"
                  size={20}
                  className="mt-[3px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-body-3-emphasis text-text-primary auth-feature-title">
                  {isDeveloper
                    ? 'Secure by default'
                    : 'Our servers are EU-based and GDPR compliant.'}
                </div>
                <p className="text-caption-1 text-text-primary auth-feature-desc">
                  {isDeveloper
                    ? 'Encrypted storage, audit-friendly logs, and least-privilege access for integrations whether self-hosted or managed.'
                    : 'All data is securely stored in the EU, fully GDPR compliant.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full sm:w-[70%] md:w-1/2 bg-white p-[20px] border border-card-border rounded-3xl elevation-1">
          <form onSubmit={handleSignUp} method="post" className="flex flex-col gap-6">
            <div className="flex flex-col gap-6">
              <h1 className="text-display-2 text-text-primary text-center auth-title">
                {isDeveloper ? 'Sign up for developer access' : 'Sign up'}
              </h1>

              <div className="flex flex-col gap-3">
                <FormInput
                  intype="text"
                  inname="first name"
                  value={firstName}
                  inlabel="First name"
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    setInputErrors((prev) => ({ ...prev, firstName: undefined }));
                  }}
                  error={inputErrors.firstName}
                />
                <FormInput
                  intype="text"
                  inname="last name"
                  value={lastName}
                  inlabel="Last name"
                  onChange={(e) => {
                    setLastName(e.target.value);
                    setInputErrors((prev) => ({ ...prev, lastName: undefined }));
                  }}
                  error={inputErrors.lastName}
                />
                <FormInput
                  intype="email"
                  inname="email"
                  value={email}
                  inlabel="Enter email"
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setInputErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  error={inputErrors.email}
                />
                <FormInputPass
                  intype="password"
                  inname="password"
                  value={password}
                  inlabel="Set up password"
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setInputErrors((prev) => ({ ...prev, pError: undefined }));
                  }}
                  error={inputErrors.pError}
                />
                <FormInputPass
                  intype="password"
                  inname="confirm-password"
                  value={confirmPassword}
                  inlabel="Confirm password"
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setInputErrors((prev) => ({ ...prev, confirmPError: undefined }));
                  }}
                  error={inputErrors.confirmPError}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex! gap-2! items-start text-caption-1 text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  aria-label="I agree to the terms and conditions and privacy policy"
                  onChange={(e) => {
                    setAgree(e.target.checked);
                    setInputErrors((prev) => ({ ...prev, agree: undefined }));
                  }}
                />
                <span>
                  {"I agree to Yosemite Crew's "}
                  <Link className="policylink" href="/terms-and-conditions?ref=signup">
                    terms and conditions
                  </Link>
                  {' and '}
                  <Link className="policylink" href="/privacy-policy?ref=signup">
                    privacy policy
                  </Link>
                </span>
              </label>
              {inputErrors.agree && (
                <div className="flex items-center gap-1 px-4 text-caption-2 text-text-error">
                  <IoIosWarning className="text-text-error" size={14} />
                  {inputErrors.agree}
                </div>
              )}
              <label className="flex! gap-2! items-end! text-caption-1 text-text-primary cursor-pointer">
                <input type="checkbox" aria-label="Sign up for newsletter and promotional emails" />
                <span>Sign me up for newsletter and promotional emails</span>
              </label>
            </div>

            <div className="flex flex-col items-center gap-3">
              <Primary
                text={isSubmitting ? 'Creating account...' : 'Sign up'}
                onClick={handleSignUp}
                href="#"
                isDisabled={isSubmitting}
                style={{ width: '100%' }}
              />
              <div className="text-body-4 text-text-primary auth-inline-text">
                {' '}
                Already have an account?{' '}
                <Link href={signinHref} className="text-text-brand">
                  Sign In
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
      <OtpModal
        email={normalizeEmail(email)}
        password={password}
        showErrorTost={showErrorTost}
        showVerifyModal={showVerifyModal}
        setShowVerifyModal={setShowVerifyModal}
        redirectPath={postAuthRedirect}
        isDeveloper={isDeveloper}
      />
      {ErrorTostPopup}
    </section>
  );
};

export default SignUp;
