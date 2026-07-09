'use client';

import { use, useMemo } from 'react';
import { redirect } from 'next/navigation';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';

type PostAuthRedirectProps = {
  fallbackRole?: string | null;
};

const PostAuthRedirect = ({ fallbackRole }: PostAuthRedirectProps) => {
  const routePromise = useMemo(() => resolvePostAuthRedirect({ fallbackRole }), [fallbackRole]);
  redirect(use(routePromise));
};

export default PostAuthRedirect;
