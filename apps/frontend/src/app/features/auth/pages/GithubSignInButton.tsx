'use client';

import { useState } from 'react';
import { IoLogoGithub } from 'react-icons/io5';
import {
  isGithubSignInEnabled,
  startGithubSignIn,
  redirectToUrl,
} from '@/app/features/auth/lib/githubOAuth';

interface GithubSignInButtonProps {
  /** Where to land after a successful GitHub sign in. */
  redirectTo?: string;
  /** Optional helper line under the button. */
  note?: string;
}

/**
 * "Continue with GitHub" for developers. Renders nothing until the Cognito Hosted
 * UI + GitHub identity provider are configured, so it never shows a dead button.
 */
export function GithubSignInButton({
  redirectTo = '/developers/home',
  note,
}: Readonly<GithubSignInButtonProps>) {
  const [pending, setPending] = useState(false);

  if (!isGithubSignInEnabled()) return null;

  const handleClick = async () => {
    setPending(true);
    const url = await startGithubSignIn(redirectTo);
    if (url) {
      redirectToUrl(url);
    } else {
      setPending(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '20px 0' }}>
        <span style={{ flex: 1, height: 1, background: '#e5dccf' }} />
        <span style={{ fontSize: 13, color: '#a9a39e' }}>or</span>
        <span style={{ flex: 1, height: 1, background: '#e5dccf' }} />
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
            color: '#a9a39e',
            letterSpacing: '-0.01em',
          }}
        >
          {note}
        </div>
      ) : null}
    </>
  );
}
