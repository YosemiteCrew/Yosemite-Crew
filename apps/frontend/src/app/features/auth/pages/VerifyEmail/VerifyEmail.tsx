'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/app/stores/authStore';
import { provisionPendingSignUpUser } from '@/app/features/auth/services/provisioning';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';

import '../AuthPages.css';

type VerifyState = 'verifying' | 'success' | 'invalid';

/**
 * Landing page for the emailed verification link. SuperTokens appends the
 * verification token to the URL; the SDK reads it from there.
 */
const VerifyEmail = () => {
  const router = useRouter();
  const [state, setState] = useState<VerifyState>('verifying');
  const [isContinuing, setIsContinuing] = useState(false);
  const hasVerifiedRef = useRef(false);

  useEffect(() => {
    if (hasVerifiedRef.current) return;
    hasVerifiedRef.current = true;
    useAuthStore
      .getState()
      .verifyEmail()
      .then((result) => {
        setState(result === 'OK' ? 'success' : 'invalid');
      })
      .catch(() => {
        setState('invalid');
      });
  }, []);

  const handleContinue = async () => {
    setIsContinuing(true);
    try {
      const user = await useAuthStore.getState().checkSession();
      if (!user) {
        router.replace('/signin');
        return;
      }
      await provisionPendingSignUpUser().catch(() => undefined);
      const route = await resolvePostAuthRedirect({
        fallbackRole: useAuthStore.getState().role,
      });
      router.replace(route);
    } catch {
      router.replace('/signin');
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
      {state === 'verifying' ? (
        <YosemiteLoader
          variant="fullscreen-translucent"
          label="Verifying your email..."
          testId="verify-email-loader"
        />
      ) : null}
      <div
        className={`
          flex h-fit w-112.5 flex-col items-center justify-center gap-6
          rounded-3xl border border-card-border
          bg-(--whitebg)
          p-5
          elevation-1
        `}
      >
        {state === 'success' && (
          <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-col gap-2">
              <h1 className="text-display-2 text-text-primary text-center">Email verified</h1>
              <div className="text-body-4 text-text-primary text-center">
                {' '}
                Your email address has been verified. You can now continue to your account.
              </div>
            </div>
            <Primary
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (!isContinuing) void handleContinue();
              }}
              text={isContinuing ? 'Redirecting...' : 'Continue'}
              style={{ width: '100%' }}
            />
          </div>
        )}
        {state === 'invalid' && (
          <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-col gap-2">
              <h1 className="text-display-2 text-text-primary text-center">
                Verification link expired
              </h1>
              <div className="text-body-4 text-text-primary text-center">
                {' '}
                This verification link is invalid or has expired. Sign in to request a new
                verification link.
              </div>
            </div>
            <Secondary href="/signin" text="Go to sign in" style={{ width: '100%' }} />
          </div>
        )}
        {state === 'verifying' && (
          <div className="flex flex-col gap-2 w-full">
            <h1 className="text-display-2 text-text-primary text-center">Verifying...</h1>
            <div className="text-body-4 text-text-primary text-center">
              {' '}
              Please wait while we verify your email address.
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default VerifyEmail;
