'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="font-satoshi font-medium text-4xl text-input-border-error">
        Something went wrong
      </div>
      <p className="text-body-4 text-text-secondary max-w-md">
        An unexpected error occurred. If this keeps happening, please contact support.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
