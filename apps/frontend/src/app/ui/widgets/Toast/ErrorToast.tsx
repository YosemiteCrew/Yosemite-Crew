import React from 'react';
import type { ToastContentProps } from 'react-toastify';
import NotifyToast, { type NotifyToastData } from '@/app/ui/widgets/Toast/NotifyToast';

/** The `error` tone of the shared runtime toast; kept as its own module so `toast.error(...)` call sites and their tests keep importing it by name. */
const ErrorToast = (props: ToastContentProps<NotifyToastData>) => (
  <NotifyToast tone="error" {...props} />
);

export default ErrorToast;
