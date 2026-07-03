'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';

import { useErrorTost } from '@/app/ui/overlays/Toast/Toast';
import { useAuthStore } from '@/app/stores/authStore';
import FormInputPass from '@/app/ui/inputs/FormInputPass/FormInputPass';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

import '../AuthPages.css';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

type PasswordErrors = {
  password?: string;
  confirmPassword?: string;
};

const getPasswordValidationErrors = (
  password: string,
  confirmPassword: string
): PasswordErrors | null => {
  if (!password) {
    return {
      password: 'Enter a new password',
      ...(confirmPassword ? {} : { confirmPassword: 'Confirm your new password' }),
    };
  }
  if (!STRONG_PASSWORD_REGEX.test(password)) {
    return {
      password:
        'Password must be at least 8 characters long, include uppercase, lowercase, number, and special character',
    };
  }
  if (!confirmPassword) {
    return { confirmPassword: 'Confirm your new password' };
  }
  if (password !== confirmPassword) {
    return { confirmPassword: 'Passwords do not match' };
  }
  return null;
};

/**
 * Landing page for the emailed password reset link. SuperTokens appends the
 * reset token to the URL; the SDK reads it from there when submitting the new
 * password.
 */
const ResetPassword = () => {
  const router = useRouter();
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inputErrors, setInputErrors] = useState<PasswordErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);

  const clearPasswordErrors = () => {
    setInputErrors({});
  };

  const handleResetPassword = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    const errors = getPasswordValidationErrors(password, confirmPassword);
    if (errors) {
      setInputErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      await resetPassword(password);
      showErrorTost({
        message: 'Password changed successfully. You can now sign in.',
        errortext: 'Success',
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
      setTimeout(() => {
        router.push('/signin');
      }, 2000);
    } catch (error: unknown) {
      setIsSubmitting(false);
      const code = (error as { code?: string })?.code;
      if (code === 'RESET_PASSWORD_INVALID_TOKEN_ERROR') {
        setLinkInvalid(true);
        return;
      }
      showErrorTost({
        message: error instanceof Error ? error.message : 'Something went wrong',
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
        {linkInvalid ? (
          <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-col gap-2">
              <h1 className="text-display-2 text-text-primary text-center">Reset link expired</h1>
              <div className="text-body-4 text-text-primary text-center">
                {' '}
                This password reset link is invalid or has expired. Request a new one to continue.
              </div>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <Primary href="/forgot-password" text="Request new link" />
              <Secondary href="/signin" text="Back to sign in" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-col gap-6 w-full">
              <h1 className="text-display-2 text-text-primary text-center">Set new password</h1>
              <div className="flex flex-col gap-3">
                <FormInputPass
                  intype="password"
                  inname="password"
                  value={password}
                  inlabel="Enter New Password"
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearPasswordErrors();
                  }}
                  error={inputErrors.password}
                />
                <FormInputPass
                  intype="password"
                  inname="confirmPassword"
                  value={confirmPassword}
                  inlabel="Confirm Password"
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearPasswordErrors();
                  }}
                  error={inputErrors.confirmPassword}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <Primary
                href="#"
                onClick={handleResetPassword}
                text={isSubmitting ? 'Resetting...' : 'Reset password'}
                isDisabled={isSubmitting}
              />
              <Secondary href="/signin" text="Back to sign in" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ResetPassword;
