'use client';

import { redirect } from 'next/navigation';

type RedirectToProps = {
  route: string;
};

/**
 * Navigates to `route` while rendering. `redirect()` throws to Next's redirect
 * boundary, which performs the replace, so nothing is painted at the old route.
 */
const RedirectTo = ({ route }: RedirectToProps) => {
  redirect(route);
};

export default RedirectTo;
