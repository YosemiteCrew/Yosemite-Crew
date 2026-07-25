'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { IoAlertCircleOutline } from 'react-icons/io5';
import { completeGithubSignIn } from '@/app/features/auth/lib/githubOAuth';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';

const GENERIC_ERROR = 'We could not complete GitHub sign in. Please try again.';

const pageStyle: CSSProperties = {
  minHeight: '100svh',
  display: 'grid',
  placeItems: 'center',
  background: 'linear-gradient(180deg, var(--page), var(--band))',
  padding: 24,
};

const cardStyle: CSSProperties = {
  width: 'min(420px, 100%)',
  textAlign: 'center',
  background: 'var(--screen)',
  border: '1px solid var(--hairline)',
  borderRadius: 24,
  padding: 'clamp(28px, 5vw, 40px)',
};

const iconBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  width: 56,
  height: 56,
  borderRadius: 9999,
  background: 'var(--danger-bg)',
  color: 'var(--danger-text)',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 18,
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-newsreader)',
  fontSize: 26,
  fontWeight: 500,
  letterSpacing: '-0.03em',
  color: 'var(--ink)',
};

const messageStyle: CSSProperties = {
  margin: '12px 0 24px',
  fontSize: 15,
  lineHeight: 1.6,
  color: 'var(--ink-muted)',
};

const backLinkStyle: CSSProperties = { padding: '13px 22px', borderRadius: 9999, fontSize: 15 };

/**
 * Completes the SuperTokens GitHub sign in on the OAuth redirect: SuperTokens
 * exchanges the code + state (read from the URL) via the backend GitHub provider,
 * establishes the session, and forwards the developer onward.
 */
export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const startedRef = useRef(false);

  // The handshake must run in the browser (it reads the OAuth code + state from the URL
  // and establishes the session), so the destination is only known client-side. The
  // effect performs the exchange; `redirect()` during render does the navigation, so the
  // loader stays on screen until Next replaces the route.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    completeGithubSignIn()
      .then(({ redirectTo: nextRoute }) => {
        setRedirectTo(nextRoute);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : GENERIC_ERROR);
      });
  }, []);

  if (redirectTo) {
    redirect(redirectTo);
  }

  if (error) {
    return (
      <main id="main-content" style={pageStyle}>
        <div style={cardStyle}>
          <span style={iconBadgeStyle}>
            <IoAlertCircleOutline style={{ fontSize: 28 }} aria-hidden="true" />
          </span>
          <h1 style={headingStyle}>Sign in interrupted</h1>
          <p style={messageStyle}>{error}</p>
          <Link href="/signin" className="yc-btn-primary" style={backLinkStyle}>
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content">
      <YosemiteLoader
        variant="fullscreen-translucent"
        label="Finishing GitHub sign in..."
        testId="github-callback-loader"
      />
    </main>
  );
}
