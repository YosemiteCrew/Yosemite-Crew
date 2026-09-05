import React from 'react';
import type { ToastContentProps } from 'react-toastify';
import NotifyToast, { type NotifyToastData } from '@/app/ui/widgets/Toast/NotifyToast';

/** The `info` tone of the shared runtime toast; kept as its own module so `toast.info(...)` call sites and their tests keep importing it by name. */
const Info = (props: ToastContentProps<NotifyToastData>) => <NotifyToast tone="info" {...props} />;

export default Info;
