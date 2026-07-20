'use client';

import { useEffect } from 'react';
import { IoAlertCircleOutline, IoRefreshOutline } from 'react-icons/io5';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import './ui/layout/states/states.css';

type GlobalErrorProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  // Uses the warm-bone state-card language shared with NotFoundState and
  // PermissionDeniedState rather than the generic Tailwind panel it used to be.
  return (
    <div className="yc-state-wrap">
      <div className="yc-state-card">
        <span className="yc-state-icon yc-state-icon--warn" aria-hidden>
          <IoAlertCircleOutline />
        </span>
        <div className="yc-state-title">Something went wrong</div>
        <p className="yc-state-text">
          An unexpected error occurred. If this keeps happening, please contact support.
        </p>
        <div className="yc-state-actions">
          <Primary text="Try again" onClick={reset} icon={<IoRefreshOutline aria-hidden />} />
          <Secondary href="/dashboard" text="Go to Dashboard" />
        </div>
      </div>
    </div>
  );
}
