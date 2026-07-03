'use client';
import React, { useId, useState } from 'react';

import { Icon } from '@iconify/react/dist/iconify.js';
import { useAuthStore } from '@/app/stores/authStore';
import { Button } from '@/app/ui';
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';
import Close from '@/app/ui/primitives/Icons/Close';

import './OtpModal.css';

type OtpModalProps = {
  email: string;
  showErrorTost: (args: {
    message: string;
    errortext: string;
    iconElement: React.ReactNode;
    className: string;
  }) => void;
  showVerifyModal: boolean;
  setShowVerifyModal: React.Dispatch<React.SetStateAction<boolean>>;
};

/**
 * Post-signup email verification modal. The provider emails a verification
 * LINK (handled on the /verify-email landing page) — this modal tells the
 * user to check their inbox and lets them request a fresh link.
 */
const OtpModal = ({
  email,
  showErrorTost,
  showVerifyModal,
  setShowVerifyModal,
}: Readonly<OtpModalProps>) => {
  const resendVerificationEmail = useAuthStore((s) => s.resendVerificationEmail);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const [isResending, setIsResending] = useState(false);

  const handleResend = async (): Promise<void> => {
    setIsResending(true);
    try {
      const result = await resendVerificationEmail();
      globalThis.window?.scrollTo({ top: 0, behavior: 'smooth' });
      if (result === 'ALREADY_VERIFIED') {
        showErrorTost({
          message: 'Your email is already verified. You can sign in now.',
          errortext: 'Already Verified',
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
      } else {
        showErrorTost({
          message: 'A new verification link has been sent to your email.',
          errortext: 'Link Sent',
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
      }
    } catch (error: unknown) {
      globalThis.window?.scrollTo({ top: 0, behavior: 'smooth' });
      showErrorTost({
        message: error instanceof Error ? error.message : 'Error resending the link.',
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
    } finally {
      setIsResending(false);
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
            aria-label="Close verification modal"
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
              A verification link has been sent to <br /> <span>{email}</span>
            </div>
            <p id={dialogDescriptionId}>
              Please check your inbox and click the verification link to activate your account. If
              you don&apos;t see the email, check your spam folder.
            </p>
          </div>
        </div>
        <div className="VerifyModalBottomInner">
          <div className="VerifyBtnDiv">
            <Button
              variant="primary"
              text={isResending ? 'Sending...' : 'Resend Verification Link'}
              type="button"
              onClick={handleResend}
              isDisabled={isResending}
              className="w-full"
            />
          </div>
          <div className="VerifyResent">
            <button type="button" onClick={() => setShowVerifyModal(false)}>
              <span>Change Email</span>
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
};

export default OtpModal;
