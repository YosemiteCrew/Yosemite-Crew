'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import { useReducedMotion } from './motion';

const CONSENT_KEY = 'yc-cookie-consent';
const EASE = 'cubic-bezier(0.16,1,0.3,1)';

const iconWrapStyle = {
  flex: 'none',
  width: 40,
  height: 40,
  borderRadius: 12,
  background: 'var(--inset)',
  color: 'var(--ink-body)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;

const acceptStyle = {
  flex: 1,
  minWidth: 150,
  cursor: 'pointer',
  fontFamily: 'inherit',
  background: 'var(--cta)',
  color: 'var(--cta-text)',
  fontSize: '14.5px',
  fontWeight: 500,
  letterSpacing: '-0.02em',
  padding: '12px 20px',
  border: 'none',
  borderRadius: 9999,
  transition: 'background 200ms',
} as const;

const rejectStyle = {
  ...acceptStyle,
  background: 'var(--screen)',
  color: 'var(--ink-body)',
  border: '1px solid var(--hairline)',
  transition: 'border-color 200ms',
} as const;

/**
 * GDPR cookie notice: a glass, dismissible banner shown once per visitor. The
 * choice is remembered in localStorage ('yc-cookie-consent' = 'all' | 'essential'),
 * so it never reappears after a decision. Rendered on the public surface only.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = globalThis.localStorage.getItem(CONSENT_KEY);
    } catch {
      /* private mode: treat as undecided and show the notice */
    }
    if (!stored) setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const raf = globalThis.requestAnimationFrame(() => setEntered(true));
    return () => globalThis.cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;

  const dismiss = (value: 'all' | 'essential') => {
    try {
      globalThis.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* private mode: nothing to persist */
    }
    setVisible(false);
  };

  const shown = reduced || entered;

  return (
    <aside
      data-yc-theme
      data-yc-cookie
      aria-label="Cookie notice"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 120,
        margin: '0 auto',
        maxWidth: 620,
        background: 'var(--glass-93)',
        backdropFilter: 'blur(40px) saturate(200%)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
        border: '1px solid var(--hairline-soft)',
        boxShadow: '0 24px 60px var(--sh18)',
        borderRadius: 24,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(24px)',
        transition: reduced ? undefined : `opacity 400ms ${EASE}, transform 400ms ${EASE}`,
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span aria-hidden="true" style={iconWrapStyle}>
          <IoShieldCheckmarkOutline style={{ fontSize: 20 }} />
        </span>
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              marginBottom: 4,
            }}
          >
            {'A note on cookies'}
          </div>
          <div
            style={{
              fontSize: '13.5px',
              lineHeight: 1.55,
              letterSpacing: '-0.01em',
              color: 'var(--ink-muted)',
            }}
          >
            {
              'We use essential cookies to keep you signed in and the site secure, plus PostHog for privacy-friendly product analytics. No advertising trackers, and nothing is sold. Reject and only the essentials load. See our '
            }
            <Link
              href="/privacy-policy"
              style={{ color: 'var(--blue-text)', textDecoration: 'none' }}
            >
              Privacy policy
            </Link>
            {'.'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => dismiss('all')} style={acceptStyle}>
          Accept all
        </button>
        <button type="button" onClick={() => dismiss('essential')} style={rejectStyle}>
          Reject non-essential
        </button>
      </div>
    </aside>
  );
}
