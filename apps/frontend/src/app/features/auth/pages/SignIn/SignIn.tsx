'use client';
import Link from 'next/link';
import React, { useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';

import FormInputPass from '@/app/ui/inputs/FormInputPass/FormInputPass';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import { useErrorTost } from '@/app/ui/overlays/Toast/Toast';
import { useAuthStore, type MfaFactorId } from '@/app/stores/authStore';
import OtpModal from '@/app/ui/overlays/OtpModal/OtpModal';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useRouter } from 'next/navigation';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { getEmailValidationError, normalizeEmail } from '@/app/lib/validators';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';
import { setStorageItem } from '@/app/lib/browserStorage';
import { defaultSidebarToCollapsed } from '@/app/lib/sidebarPreference';
import { provisionPendingSignUpUser } from '@/app/features/auth/services/provisioning';

import '../AuthPages.css';

type SignInProps = {
  redirectPath?: string;
  signupHref?: string;
  allowNext?: boolean;
  isDeveloper?: boolean;
};

const dangerToastIcon = (
  <Icon icon="solar:danger-triangle-bold" width="20" height="20" color="var(--color-danger-600)" />
);

type MfaChallengePanelProps = {
  factor: MfaFactorId;
  code: string;
  codeError?: string;
  isSubmitting: boolean;
  onCodeChange: (value: string) => void;
  onVerify: (e: React.SyntheticEvent) => void;
  onResend: () => void;
  onCancel: () => void;
};

const MfaChallengePanel = ({
  factor,
  code,
  codeError,
  isSubmitting,
  onCodeChange,
  onVerify,
  onResend,
  onCancel,
}: Readonly<MfaChallengePanelProps>) => (
  <form onSubmit={onVerify} className="flex size-full flex-col gap-6">
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-display-2 text-text-primary text-center auth-title">
        Two-factor authentication
      </h1>
      <p className="text-body-4 text-text-primary text-center">
        {factor === 'totp'
          ? 'Enter the 6-digit code from your authenticator app.'
          : 'We sent a 6-digit code to your email. Enter it below to continue.'}
      </p>
      <FormInput
        intype="text"
        inname="mfa-code"
        value={code}
        inlabel="6-digit code"
        onChange={(e) => onCodeChange(e.target.value)}
        error={codeError}
      />
    </div>
    <div className="flex flex-col gap-3 items-center">
      <Primary
        text={isSubmitting ? 'Verifying...' : 'Verify'}
        onClick={onVerify}
        isDisabled={isSubmitting}
        style={{ width: '100%' }}
      />
      {factor === 'otp-email' && (
        <button type="button" className="text-body-4 text-text-brand" onClick={onResend}>
          Resend code
        </button>
      )}
      <Secondary href="#" text="Back to sign in" onClick={onCancel} style={{ width: '100%' }} />
    </div>
  </form>
);

const SignIn = ({
  redirectPath,
  signupHref = '/signup',
  isDeveloper = false,
}: Readonly<SignInProps>) => {
  const { signIn, completeTotpChallenge, completeEmailOtpChallenge, requestEmailOtp, role } =
    useAuthStore();
  const router = useRouter();
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inputErrors, setInputErrors] = useState<{
    email?: string;
    pError?: string;
  }>({});

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfaFactor, setMfaFactor] = useState<MfaFactorId | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaCodeError, setMfaCodeError] = useState<string | undefined>(undefined);

  const showDangerToast = (message: string) => {
    showErrorTost({
      message,
      errortext: 'Error',
      iconElement: dangerToastIcon,
      className: 'errofoundbg',
    });
  };

  const finishSignIn = async () => {
    defaultSidebarToCollapsed();
    // Set devAuth flag BEFORE redirect so DevRouteGuard can read it
    setStorageItem('session', 'devAuth', isDeveloper ? 'true' : 'false');
    try {
      await provisionPendingSignUpUser();
    } catch (error) {
      console.log(error);
      await useAuthStore.getState().signout();
      setIsSubmitting(false);
      showDangerToast('Sign in failed');
      return;
    }
    const signedInRole =
      typeof useAuthStore.getState === 'function' ? useAuthStore.getState().role : role;
    const nextRoute = await resolvePostAuthRedirect({
      fallbackRole: signedInRole,
      redirectPath,
      isDeveloper,
    });
    router.replace(nextRoute);
  };

  const startMfaChallenge = async (factors: MfaFactorId[]) => {
    const factor = factors[0] ?? 'otp-email';
    setMfaFactor(factor);
    setMfaCode('');
    setMfaCodeError(undefined);
    setIsSubmitting(false);
    if (factor === 'otp-email') {
      try {
        await requestEmailOtp();
      } catch (error: any) {
        showDangerToast(error?.message || 'Failed to send the verification code.');
      }
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
      const result = await signIn(normalizedEmail, password);
      if (result.status === 'EMAIL_VERIFICATION_REQUIRED') {
        setIsSubmitting(false);
        setShowVerifyModal(true);
        return;
      }
      if (result.status === 'MFA_REQUIRED') {
        await startMfaChallenge(result.factors);
        return;
      }
      await finishSignIn();
    } catch (error: any) {
      setIsSubmitting(false);
      showDangerToast(error.message || `Sign in failed`);
    }
  };

  const handleVerifyMfa = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const code = mfaCode.trim();
    if (code.length === 0) {
      setMfaCodeError('Enter the 6-digit code');
      return;
    }
    try {
      setIsSubmitting(true);
      if (mfaFactor === 'totp') {
        await completeTotpChallenge(code);
      } else {
        await completeEmailOtpChallenge(code);
      }
      await finishSignIn();
    } catch (error: any) {
      setIsSubmitting(false);
      setMfaCodeError(error?.message || 'Verification failed. Please try again.');
    }
  };

  const handleResendMfaCode = async () => {
    try {
      await requestEmailOtp();
      setMfaCode('');
      setMfaCodeError(undefined);
    } catch (error: any) {
      showDangerToast(error?.message || 'Failed to send the verification code.');
    }
  };

  const handleCancelMfa = async () => {
    setMfaFactor(null);
    setMfaCode('');
    setMfaCodeError(undefined);
    setIsSubmitting(false);
    try {
      await useAuthStore.getState().signout();
    } catch (error) {
      console.log(error);
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
      {isSubmitting ? (
        <YosemiteLoader
          variant="fullscreen-translucent"
          label="Signing you in..."
          testId="signin-loader"
        />
      ) : null}
      {ErrorTostPopup}
      <div
        className={`
          flex h-fit w-[min(520px,90vw)] flex-col items-center justify-center gap-6
          rounded-3xl border border-card-border
          bg-(--whitebg)
          p-[1.5rem]
          sm:p-[1.75rem]
          elevation-1
        `}
      >
        {mfaFactor ? (
          <MfaChallengePanel
            factor={mfaFactor}
            code={mfaCode}
            codeError={mfaCodeError}
            isSubmitting={isSubmitting}
            onCodeChange={(value) => {
              setMfaCode(value);
              setMfaCodeError(undefined);
            }}
            onVerify={handleVerifyMfa}
            onResend={handleResendMfaCode}
            onCancel={handleCancelMfa}
          />
        ) : (
          <form onSubmit={handleSignIn} className="flex size-full flex-col gap-6">
            <div className="flex w-full flex-col gap-6">
              <h1 className="text-display-2 text-text-primary text-center auth-title">
                {isDeveloper ? 'Sign in to your developer account' : 'Sign in'}
              </h1>
              <div className="flex w-full flex-col gap-3">
                <FormInput
                  intype="email"
                  inname="email"
                  value={email}
                  inlabel="Email"
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
                  inlabel="Password"
                  autoComplete="current-password"
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setInputErrors((prev) => ({ ...prev, pError: undefined }));
                  }}
                  error={inputErrors.pError}
                />
                <div className="flex items-end justify-end">
                  <Link
                    href="/forgot-password"
                    className="text-body-4-emphasis text-text-primary! auth-link-text"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 items-center">
              <Primary
                text={isSubmitting ? 'Signing in...' : 'Sign in'}
                onClick={handleSignIn}
                isDisabled={isSubmitting}
                style={{ width: '100%' }}
              />
              <div className="text-body-4 text-text-primary auth-inline-text">
                {' '}
                Don&apos;t have an account?{' '}
                <Link href={signupHref} className="text-text-brand">
                  Sign up
                </Link>
              </div>
            </div>
          </form>
        )}
      </div>
      <OtpModal
        email={normalizeEmail(email)}
        showErrorTost={showErrorTost}
        showVerifyModal={showVerifyModal}
        setShowVerifyModal={setShowVerifyModal}
      />
    </section>
  );
};

export default SignIn;
