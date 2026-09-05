'use client';

import { useState } from 'react';
import { IoLogoGithub } from 'react-icons/io5';
import {
  isGithubSignInEnabled,
  startGithubSignIn,
  redirectToUrl,
} from '@/app/features/auth/lib/githubOAuth';
import { logger } from '@/app/lib/logger';

interface GithubSignInButtonProps {
  /** Where to land after a successful GitHub sign in. */
  redirectTo?: string;
  /** Optional helper line under the button. */
  note?: string;
}

/**
 * "Continue with GitHub" for developers. Renders nothing until the SuperTokens
 * GitHub provider is enabled (NEXT_PUBLIC_AUTH_GITHUB_ENABLED), so it never shows
 * a dead button.
 */
export function GithubSignInButton({
  redirectTo = '/developers/home',
  note,
}: Readonly<GithubSignInButtonProps>) {
  const [pending, setPending] = useState(false);

  if (!isGithubSignInEnabled()) return null;

  const handleClick = async () => {
    setPending(true);
    let redirecting = false;
    try {
      const url = await startGithubSignIn(redirectTo);
      if (url) {
        redirecting = true;
        redirectToUrl(url);
      }
    } catch (error) {
      logger.error('GitHub sign in could not start', error);
    } finally {
      // Busy only while the browser is actually leaving for GitHub. Every other
      // exit - no URL, or a rejected handshake - hands the button back, which is
      // why this sits in `finally` rather than after the await.
      setPending(redirecting);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '20px 0' }}>
        <span style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
        <span style={{ fontSize: 13, color: 'var(--ink-faint2)' }}>or</span>
        <span style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
      </div>
      <button
        type="button"
        className="yc-btn-ghost"
        disabled={pending}
        onClick={() => {
          void handleClick();
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          fontSize: 15,
          padding: '14px 20px',
          borderRadius: 13,
        }}
      >
        <IoLogoGithub style={{ fontSize: 19 }} aria-hidden="true" />
        {pending ? 'Redirecting to GitHub...' : 'Continue with GitHub'}
      </button>
      {note ? (
        <div
          style={{
            marginTop: 11,
            textAlign: 'center',
            fontSize: 12.5,
            color: 'var(--ink-faint2)',
            letterSpacing: '-0.01em',
          }}
        >
          {note}
        </div>
      ) : null}
    </>
  );
}
