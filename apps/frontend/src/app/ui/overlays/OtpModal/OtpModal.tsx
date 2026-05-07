'use client';
import React, { useState, useRef, useEffect, useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Icon } from '@iconify/react/dist/iconify.js';
import { useAuthStore } from '@/app/stores/authStore';
import { postData } from '@/app/services/axios';
import { useSignOut } from '@/app/hooks/useAuth';
import Close from '@/app/ui/primitives/Icons/Close';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';
import { defaultSidebarToCollapsed } from '@/app/lib/sidebarPreference';

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
  const [code, setCode] = useState(new Array(6).fill(''));
  const [activeInput, setActiveInput] = useState(0);
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

  const [timer, setTimer] = useState(150); // 2.30 minutes in seconds
  const [timerActive, setTimerActive] = useState(false);
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
      otpRefs.current[idx + 1]?.focus();
      setActiveInput(idx + 1);
    }
  };

  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace') {
      if (code[idx]) {
        const newCode = [...code];
        newCode[idx] = '';
        setCode(newCode);
      } else if (idx > 0) {
        otpRefs.current[idx - 1]?.focus();
        setActiveInput(idx - 1);
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
      setActiveInput(idx - 1);
    } else if (e.key === 'ArrowRight' && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
      setActiveInput(idx + 1);
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
          globalThis.window?.sessionStorage?.setItem('devAuth', isDeveloper ? 'true' : 'false');
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
        setActiveInput(0); // Focus first input
        setTimer(150);
        setTimerActive(true);
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

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (showVerifyModal && timerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    if (timer === 0 && interval) {
      clearInterval(interval);
      setTimerActive(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showVerifyModal, timerActive, timer]);

  useEffect(() => {
    if (showVerifyModal) {
      setTimer(150);
      setTimerActive(true);
    }
  }, [showVerifyModal]);

  if (!showVerifyModal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="presentation"
    >
      <div
        className="VerifyModalSec"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
      >
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
            <div
              className="verifyInput"
              style={{ marginBottom: 24 }}
              role="group"
              aria-label="Email verification code"
              aria-describedby={`${otpHintId} ${invalidOtp ? otpStatusId : ''}`.trim()}
            >
              {code.map((digit, idx) => (
                <input
                  key={`${digit}-${idx}`}
                  ref={(el) => setOtpRef(el, idx)}
                  type="text"
                  maxLength={1}
                  value={digit}
                  autoFocus={activeInput === idx}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Digit ${idx + 1} of 6`}
                  onChange={(e) => handleCodeChange(e, idx)}
                  onKeyDown={(e) => handleCodeKeyDown(e, idx)}
                />
              ))}
            </div>
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
        <div className="VerifyModalBottomInner">
          <div className="VerifyBtnDiv">
            <button
              type="button"
              onClick={handleVerify}
              disabled={isVerifying || timer === 0 || code.includes('')}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isVerifying ? 'Verifying...' : 'Verify Code'}
            </button>
            <span role="status" aria-live="polite">
              {timer > 0
                ? `${String(Math.floor(timer / 60)).padStart(2, '0')}:${String(timer % 60).padStart(2, '0')} sec`
                : 'Code expired'}
            </span>
          </div>
          <div className="VerifyResent">
            <Link
              href=""
              onClick={(e) => {
                e.preventDefault();
                handleResend();
              }}
            >
              <span>Request New Code</span>
            </Link>
            <Link href="#" onClick={() => setShowVerifyModal(false)}>
              . Change Email
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OtpModal;
