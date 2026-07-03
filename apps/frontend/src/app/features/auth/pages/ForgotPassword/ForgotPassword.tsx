'use client';
import React, { useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';

import { useErrorTost } from '@/app/ui/overlays/Toast/Toast';
import { useAuthStore } from '@/app/stores/authStore';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';

import './ForgotPassword.css';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { getEmailValidationError, normalizeEmail } from '@/app/lib/validators';

const scrollToTop = () => {
  if (globalThis.window) {
    globalThis.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

const ForgotPassword = () => {
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  const { forgotPassword } = useAuthStore();

  const [linkSent, setLinkSent] = useState(false);
  const [email, setEmail] = useState('');
  const [inputErrors, setInputErrors] = useState<{ email?: string }>({});

  const handleSendResetLink = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    const emailError = getEmailValidationError(
      normalizedEmail,
      'Email is required',
      'Enter a valid email'
    );

    if (emailError) {
      setInputErrors((prev) => ({ ...prev, email: emailError }));
      scrollToTop();
      showErrorTost({
        message: emailError,
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
      const data = await forgotPassword(normalizedEmail);
      if (data) {
        setInputErrors({});
        scrollToTop();
        showErrorTost({
          message: 'If an account with this email exists, a reset link has been sent',
          errortext: 'Success',
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
        setLinkSent(true);
      }
    } catch (error: unknown) {
      scrollToTop();
      const message = error instanceof Error ? error.message : 'Unable to connect to the server.';
      showErrorTost({
        message: `Reset link failed: ${message}`,
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
      {ErrorTostPopup}
      <div
        className={`
          flex h-fit w-112.5 flex-col items-center justify-center gap-6
          rounded-3xl border border-card-border
          bg-(--whitebg)
          p-5
          elevation-1
        `}
      >
        {linkSent ? (
          <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-col gap-2">
              <h1 className="text-display-2 text-text-primary text-center">Check your email</h1>
              <div className="text-body-4 text-text-primary text-center">
                {' '}
                We sent a password reset link to <strong>{normalizeEmail(email)}</strong>. Click the
                link in the email to set a new password.
              </div>
            </div>
            <div className="flex flex-col gap-3 items-center w-full">
              <Primary
                href="#"
                onClick={handleSendResetLink}
                text="Resend link"
                style={{ width: '100%' }}
              />
              <Secondary href="/signin" text="Back to sign in" style={{ width: '100%' }} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-display-2 text-text-primary text-center">Forgot password?</h1>
              <div className="text-body-4 text-text-primary text-center">
                {' '}
                Enter your registered email, and we&rsquo;ll send you a link to reset it.
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <FormInput
                intype="email"
                inname="email"
                value={email}
                inlabel="Email Address"
                onChange={(e) => {
                  setEmail(e.target.value);
                  setInputErrors((prev) => ({ ...prev, email: undefined }));
                }}
                error={inputErrors.email}
              />
              <div className="flex flex-col gap-2">
                <Primary href="#" onClick={handleSendResetLink} text="Send reset link" />
                <Secondary href="/signin" text="Back" />
              </div>
            </div>
          </div>
        )}
      </div>
      {ErrorTostPopup}
    </section>
  );
};

export default ForgotPassword;
