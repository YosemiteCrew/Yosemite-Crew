import React from 'react';
import type { ToastContentProps } from 'react-toastify';
import NotifyToast, { type NotifyToastData } from '@/app/ui/widgets/Toast/NotifyToast';

/** The `success` tone of the shared runtime toast; kept as its own module so `toast.success(...)` call sites and their tests keep importing it by name. */
const Success = (props: ToastContentProps<NotifyToastData>) => (
  <NotifyToast tone="success" {...props} />
);

export default Success;
