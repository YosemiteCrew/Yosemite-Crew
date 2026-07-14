'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';

type PostAuthRedirectProps = {
  fallbackRole?: string | null;
};

const PostAuthRedirect = ({ fallbackRole }: PostAuthRedirectProps) => {
  const router = useRouter();

  // Resolve and navigate from an effect. Suspending on a promise created during
  // render is uncached in Client Components and can blank the page or re-suspend;
  // an effect runs exactly once after commit and drives a reliable redirect.
  useEffect(() => {
    let cancelled = false;
    resolvePostAuthRedirect({ fallbackRole }).then((nextRoute) => {
      if (!cancelled) router.replace(nextRoute);
    });
    return () => {
      cancelled = true;
    };
  }, [fallbackRole, router]);

  return null;
};

export default PostAuthRedirect;
