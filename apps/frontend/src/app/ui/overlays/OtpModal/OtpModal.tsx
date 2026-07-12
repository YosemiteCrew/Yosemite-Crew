'use client';
import React, { useState, useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Icon } from '@iconify/react/dist/iconify.js';
import { useAuthStore } from '@/app/stores/authStore';
import { logger } from '@/app/lib/logger';
import { provisionBackendUser } from '@/app/features/auth/services/userProvisioningService';
import { useOtpCodeInput } from '@/app/hooks/useOtpCodeInput';
import { useResendCountdown } from '@/app/hooks/useResendCountdown';
import { Button } from '@/app/ui';
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';
import Close from '@/app/ui/primitives/Icons/Close';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';
import { setStorageItem } from '@/app/lib/browserStorage';
import { defaultSidebarToCollapsed } from '@/app/lib/sidebarPreference';

import './OtpModal.css';

const RESEND_COUNTDOWN_SECONDS = 150;
const OTP_DIGIT_FIELD_IDS = [
  'otp-digit-1',
  'otp-digit-2',
  'otp-digit-3',
  'otp-digit-4',
  'otp-digit-5',
  'otp-digit-6',
] as const;

type ShowErrorTost = (args: {
  message: string;
  errortext: string;
  iconElement: React.ReactNode;
  className: string;
}) => void;

type OtpModalProps = {
  email: string;
  password: string;
  showErrorTost: ShowErrorTost;
  showVerifyModal: boolean;
  setShowVerifyModal: React.Dispatch<React.SetStateAction<boolean>>;
  redirectPath?: string;
  isDeveloper?: boolean;
};

const dangerIcon = (
  <Icon icon="solar:danger-triangle-bold" width="20" height="20" color="var(--color-danger-600)" />
);

type OtpDigitFieldsProps = {
  code: string[];
  describedBy: string;
  setOtpRef: (el: HTMLInputElement | null, idx: number) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>, idx: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => void;
};

const OtpDigitFields = ({
  code,
  describedBy,
  setOtpRef,
  onChange,
  onKeyDown,
}: OtpDigitFieldsProps) => (
  <fieldset
    className="verifyInput"
    style={{ marginBottom: 24 }}
    aria-label="Email verification code"
    aria-describedby={describedBy}
  >
    {OTP_DIGIT_FIELD_IDS.map((fieldId, idx) => (
      <input
        key={fieldId}
        ref={(el) => setOtpRef(el, idx)}
        type="text"
        maxLength={1}
        value={code[idx] ?? ''}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete={idx === 0 ? 'one-time-code' : 'off'}
        aria-label={`Digit ${idx + 1} of 6`}
        onChange={(e) => onChange(e, idx)}
        onKeyDown={(e) => onKeyDown(e, idx)}
      />
    ))}
  </fieldset>
);

type VerifyModalFooterProps = {
  isVerifying: boolean;
  canVerify: boolean;
  secondsLeft: number;
  onVerify: () => void;
  onResend: () => void;
  onChangeEmail: () => void;
};

const VerifyModalFooter = ({
  isVerifying,
  canVerify,
  secondsLeft,
  onVerify,
  onResend,
  onChangeEmail,
}: VerifyModalFooterProps) => (
  <div className="VerifyModalBottomInner">
    <div className="VerifyBtnDiv">
      <Button
        variant="primary"
        text={isVerifying ? 'Verifying...' : 'Verify Code'}
        type="button"
        onClick={onVerify}
        isDisabled={isVerifying || !canVerify || secondsLeft === 0}
        className="w-full"
      />
      <output aria-live="polite">
        {secondsLeft > 0
          ? `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(
              secondsLeft % 60
            ).padStart(2, '0')} sec`
          : 'Didn’t get the code? Request a new one below.'}
      </output>
    </div>
    <div className="VerifyResent">
      <Link
        href=""
        onClick={(e) => {
          e.preventDefault();
          onResend();
        }}
      >
        <span>Request New Code</span>
      </Link>
      <Link href="#" onClick={onChangeEmail}>
        . Change Email
      </Link>
    </div>
  </div>
);

const OtpModal = ({
  email,
  password,
  showErrorTost,
  showVerifyModal,
  setShowVerifyModal,
  redirectPath,
  isDeveloper = false,
}: Readonly<OtpModalProps>) => {
  const { confirmSignUp, resendCode, signIn, role } = useAuthStore();
  const router = useRouter();
  const [invalidOtp, setInvalidOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const otpHintId = useId();
  const otpStatusId = useId();

  const { code, handleCodeChange, handleCodeKeyDown, resetCode, setOtpRef } = useOtpCodeInput(() =>
    setInvalidOtp(false)
  );
  const { restart: restartCountdown, secondsLeft } = useResendCountdown(
    showVerifyModal,
    RESEND_COUNTDOWN_SECONDS
  );

  const buildSignInFallbackRoute = () => {
    const signinPath = isDeveloper ? '/developers/signin' : '/signin';
    const params = new URLSearchParams({ email });
    if (redirectPath) params.set('next', redirectPath);
    return `${signinPath}?${params.toString()}`;
  };

  const redirectToSignInAfterSignup = () => {
    showErrorTost({
      message: 'Your email is verified. Please sign in to continue.',
      errortext: 'Account created',
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
    router.push(buildSignInFallbackRoute());
  };

  const completeSignedInRedirect = async () => {
    defaultSidebarToCollapsed();
    // Set devAuth flag BEFORE redirect so DevRouteGuard can read it
    setStorageItem('session', 'devAuth', isDeveloper ? 'true' : 'false');

    // The Cognito session is valid at this point. If backend provisioning
    // keeps failing transiently, continue anyway — the account exists and
    // signing the user out here is worse than a delayed provision.
    const provisioned = await provisionBackendUser();
    if (!provisioned) {
      logger.warn('Backend user provisioning did not complete; continuing signed in.');
    }

    const signedInRole =
      typeof useAuthStore.getState === 'function' ? useAuthStore.getState().role : role;
    const nextRoute = await resolvePostAuthRedirect({
      fallbackRole: signedInRole,
      redirectPath,
      isDeveloper,
    });
    router.push(nextRoute);
  };

  const handleVerify = async (): Promise<void> => {
    if (secondsLeft === 0) {
      showErrorTost({
        message: 'This verification code has expired. Please request a new code.',
        errortext: 'Code expired',
        iconElement: dangerIcon,
        className: 'errofoundbg',
      });
      return;
    }

    if (code.includes('')) {
      showErrorTost({
        message: 'Please enter the full OTP',
        errortext: 'Error',
        iconElement: dangerIcon,
        className: 'errofoundbg',
      });
      return;
    }

    let confirmed = false;
    try {
      setIsVerifying(true);
      const result = await confirmSignUp(email, code.join(''));
      if (!result) {
        setIsVerifying(false);
        return;
      }
      confirmed = true;
      resetCode();
      setShowVerifyModal(false);
      await signIn(email, password);
      await completeSignedInRedirect();
    } catch (error) {
      setIsVerifying(false);
      if (confirmed) {
        // The account is verified — never strand the user on the signup page.
        // Send them to sign in with their email prefilled instead.
        logger.warn('Automatic sign in after signup failed; redirecting to sign in.', error);
        redirectToSignInAfterSignup();
        return;
      }
      globalThis.window?.scrollTo({ top: 0, behavior: 'smooth' });
      logger.warn('OTP confirmation failed', error);
      setInvalidOtp(true);
    }
  };

  const handleResend = async (): Promise<void> => {
    try {
      const result = await resendCode(email);
      if (result) {
        globalThis.window?.scrollTo({ top: 0, behavior: 'smooth' });
        showErrorTost({
          message: 'A new verification code has been sent to your email.',
          errortext: 'Code Resent',
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
        resetCode(true); // Clear OTP fields and focus the first input
        restartCountdown();
      }
    } catch (error: any) {
      globalThis.window?.scrollTo({ top: 0, behavior: 'smooth' });
      showErrorTost({
        message: error.message || 'Error resending code.',
        errortext: 'Error',
        iconElement: dangerIcon,
        className: 'errofoundbg',
      });
    }
  };

  if (!showVerifyModal) return null;

  return (
    <ModalBase
      showModal={showVerifyModal}
      setShowModal={setShowVerifyModal}
      canClose={() => false}
      overlayClassName="fixed inset-0 z-1001 bg-black/50"
      containerClassName="fixed inset-0 z-1001 flex items-center justify-center p-4"
      aria-labelledby={dialogTitleId}
      aria-describedby={dialogDescriptionId}
    >
      <div className="VerifyModalSec">
        <div className="VerifyModalClose">
          <button
            type="button"
            aria-label="Close OTP modal"
            className="VerifyModalCloseBtn"
            onClick={() => setShowVerifyModal(false)}
          >
            <Close iconOnly />
          </button>
        </div>
        <div className="VerifyModalTopInner">
          <div className="VerifyTexted">
            <h2 id={dialogTitleId} className="text-display-2 text-text-primary">
              Verify Email Address
            </h2>
            <div className="text-body-3-emphasis text-text-primary">
              A Verification code has been sent to <br /> <span>{email}</span>
            </div>
            <p id={dialogDescriptionId}>
              Please check your inbox and enter the verification code below to verify your email
              address. The Code will expire soon.
            </p>
          </div>
          <div className="verifyInputDiv">
            <OtpDigitFields
              code={code}
              describedBy={`${otpHintId} ${invalidOtp ? otpStatusId : ''}`.trim()}
              setOtpRef={setOtpRef}
              onChange={handleCodeChange}
              onKeyDown={handleCodeKeyDown}
            />
            <p id={otpHintId} className="text-caption-1 text-text-secondary">
              Enter the 6-digit code from your email.
            </p>
            {invalidOtp ? (
              <p id={otpStatusId} role="alert">
                <Icon icon="solar:danger-circle-bold" width="18" height="18" /> Invalid OTP
              </p>
            ) : (
              ''
            )}{' '}
          </div>
        </div>
        <VerifyModalFooter
          isVerifying={isVerifying}
          canVerify={!code.includes('')}
          secondsLeft={secondsLeft}
          onVerify={handleVerify}
          onResend={handleResend}
          onChangeEmail={() => setShowVerifyModal(false)}
        />
      </div>
    </ModalBase>
  );
};

export default OtpModal;
