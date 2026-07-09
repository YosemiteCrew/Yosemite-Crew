'use client';
import React, { useState, useRef, useId, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Icon } from '@iconify/react/dist/iconify.js';
import { useAuthStore } from '@/app/stores/authStore';
import { postData } from '@/app/services/axios';
import { useSignOut } from '@/app/hooks/useAuth';
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';
import Close from '@/app/ui/primitives/Icons/Close';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';
import { setStorageItem } from '@/app/lib/browserStorage';
import { defaultSidebarToCollapsed } from '@/app/lib/sidebarPreference';
import OtpDigitFieldset from '@/app/ui/overlays/OtpModal/OtpDigitFieldset';
import OtpModalHeader from '@/app/ui/overlays/OtpModal/OtpModalHeader';
import OtpModalFooter from '@/app/ui/overlays/OtpModal/OtpModalFooter';

import './OtpModal.css';

type OtpModalProps = {
  email: string;
  password: string;
  showErrorTost: (args: {
    message: string;
    errortext: string;
    iconElement: React.ReactNode;
    className: string;
  }) => void;
  showVerifyModal: boolean;
  setShowVerifyModal: React.Dispatch<React.SetStateAction<boolean>>;
  redirectPath?: string;
  isDeveloper?: boolean;
};

const OtpModal = ({
  email,
  password,
  showErrorTost,
  showVerifyModal,
  setShowVerifyModal,
  redirectPath,
  isDeveloper = false,
}: Readonly<OtpModalProps>) => {
  const { signOut } = useSignOut();
  const { confirmSignUp, resendCode, signIn, role } = useAuthStore();
  const router = useRouter();
  const [code, setCode] = useState(() => new Array(6).fill(''));
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [invalidOtp, setInvalidOtp] = useState(false);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const otpHintId = useId();
  const otpStatusId = useId();
  // Stable ref callback to avoid React warning
  const setOtpRef = (el: HTMLInputElement | null, idx: number) => {
    otpRefs.current[idx] = el;
  };
  // The active input is only ever read to move focus, never rendered — track it in a
  // ref and focus imperatively instead of round-tripping through state + an effect.
  const focusInput = (idx: number) => {
    otpRefs.current[idx]?.focus();
  };

  const [timer, setTimer] = useState(150); // 2.30 minutes in seconds
  const timerActiveRef = useRef(showVerifyModal);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const val = e.target.value.replaceAll(/\D/g, '');
    if (!val) return;
    const newCode = [...code];
    newCode[idx] = val[0];
    setCode(newCode);
    if (invalidOtp) {
      setInvalidOtp(false);
    }
    if (idx < 5 && val) {
      focusInput(idx + 1);
    }
  };

  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace') {
      if (code[idx]) {
        const newCode = [...code];
        newCode[idx] = '';
        setCode(newCode);
      } else if (idx > 0) {
        focusInput(idx - 1);
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      focusInput(idx - 1);
    } else if (e.key === 'ArrowRight' && idx < 5) {
      focusInput(idx + 1);
    }
  };

  const afterAuthSuccess = async () => {
    try {
      await postData('/fhir/v1/user');
    } catch (error) {
      await signOut();
      throw error;
    }
  };

  const handleVerify = async (): Promise<void> => {
    if (code.includes('')) {
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

    try {
      setIsVerifying(true);
      const result = await confirmSignUp(email, code.join(''));
      if (result) {
        setCode(new Array(6).fill(''));
        setShowVerifyModal(false);
        try {
          await signIn(email, password);
          defaultSidebarToCollapsed();
          await afterAuthSuccess();
          // Set devAuth flag BEFORE redirect so DevRouteGuard can read it
          setStorageItem('session', 'devAuth', isDeveloper ? 'true' : 'false');
          const signedInRole =
            typeof useAuthStore.getState === 'function' ? useAuthStore.getState().role : role;
          const nextRoute = await resolvePostAuthRedirect({
            fallbackRole: signedInRole,
            redirectPath,
            isDeveloper,
          });
          router.push(nextRoute);
        } catch (error) {
          console.log(error);
          setIsVerifying(false);
          showErrorTost({
            message: `Sign in failed`,
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
    } catch (error: any) {
      globalThis.window?.scrollTo({ top: 0, behavior: 'smooth' });
      console.log(error);
      setIsVerifying(false);
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
        setCode(new Array(6).fill('')); // Clear OTP fields on resend
        focusInput(0); // Focus first input
        setTimer(150);
        timerActiveRef.current = true;
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

  useLayoutEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (showVerifyModal && timerActiveRef.current && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    if (timer === 0 && interval) {
      clearInterval(interval);
      timerActiveRef.current = false;
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showVerifyModal, timer]);

  useLayoutEffect(() => {
    if (showVerifyModal) {
      setTimer(150);
      timerActiveRef.current = true;
    }
  }, [showVerifyModal]);

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
          timer={timer}
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
