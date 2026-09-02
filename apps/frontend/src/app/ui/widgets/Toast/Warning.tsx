import React from 'react';
import type { ToastContentProps } from 'react-toastify';
import NotifyToast, { type NotifyToastData } from '@/app/ui/widgets/Toast/NotifyToast';

/** The `warning` tone of the shared runtime toast; kept as its own module so `toast.warning(...)` call sites and their tests keep importing it by name. */
const Warning = (props: ToastContentProps<NotifyToastData>) => (
  <NotifyToast tone="warning" {...props} />
);

export default Warning;
