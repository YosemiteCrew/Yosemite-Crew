'use client';

import { redirect } from 'next/navigation';
import { sanitizeNextPath } from '@/app/lib/safeNextPath';

type RedirectToProps = {
  route: string;
};

/**
 * Navigates to `route` while rendering. `redirect()` throws to Next's redirect
 * boundary, which performs the replace, so nothing is painted at the old route.
 * Only same-origin paths are followed; anything else goes to the home page.
 */
const RedirectTo = ({ route }: RedirectToProps) => {
  redirect(sanitizeNextPath(route) ?? '/');
};

export default RedirectTo;
