'use client';
import React, { useState, useId } from 'react';
import { useRouter } from 'next/navigation';

import { Icon } from '@/app/ui/icons/Icon';
import { useAuthStore } from '@/app/stores/authStore';
import { logger } from '@/app/lib/logger';
import { provisionBackendUser } from '@/app/features/auth/services/userProvisioningService';
import { useOtpCodeInput } from '@/app/hooks/useOtpCodeInput';
import { useResendCountdown } from '@/app/hooks/useResendCountdown';
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';
import Close from '@/app/ui/primitives/Icons/Close';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';
import { setStorageItem } from '@/app/lib/browserStorage';
import { resetSidebarPreference } from '@/app/lib/sidebarPreference';
import OtpDigitFieldset from '@/app/ui/overlays/OtpModal/OtpDigitFieldset';
import OtpModalHeader from '@/app/ui/overlays/OtpModal/OtpModalHeader';
import OtpModalFooter from '@/app/ui/overlays/OtpModal/OtpModalFooter';

import './OtpModal.css';

const RESEND_COUNTDOWN_SECONDS = 150;

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
    resetSidebarPreference();
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
    // `secondsLeft` is the RESEND countdown - how long before another code can
    // be requested - not the code's lifetime. Blocking verification on it locked
    // users out of a code the auth provider still considered valid, forcing a
    // pointless resend. The provider is the authority on expiry and returns a
    // clear error, which the catch below already surfaces.
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
      overlayClassName="fixed inset-0 z-1001 bg-[var(--sh55)] backdrop-blur-[6px]"
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
          <OtpModalHeader
            dialogTitleId={dialogTitleId}
            dialogDescriptionId={dialogDescriptionId}
            email={email}
          />
          <OtpDigitFieldset
            code={code}
            otpHintId={otpHintId}
            otpStatusId={otpStatusId}
            invalidOtp={invalidOtp}
            setOtpRef={setOtpRef}
            onCodeChange={handleCodeChange}
            onCodeKeyDown={handleCodeKeyDown}
          />
        </div>
        <OtpModalFooter
          isVerifying={isVerifying}
          timer={secondsLeft}
          code={code}
          onVerify={handleVerify}
          onResend={handleResend}
          onChangeEmail={() => setShowVerifyModal(false)}
        />
      </div>
    </ModalBase>
  );
};

export default OtpModal;
