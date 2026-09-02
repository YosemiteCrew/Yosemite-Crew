import { useCallback } from 'react';
import { toast, ToastOptions } from 'react-toastify';
import ErrorToast from '../ui/widgets/Toast/ErrorToast';
import InfoToast from '../ui/widgets/Toast/Info';
import WarningToast from '../ui/widgets/Toast/Warning';
import Success from '../ui/widgets/Toast/Success';

export type NotifyType = 'success' | 'error' | 'info' | 'warning';

export type NotifyData = {
  title: string;
  text: string;
};

type ToastRenderer = (content: any, options?: ToastOptions) => void;

type ToastConfigItem = {
  show: ToastRenderer;
  Component: any;
  options?: ToastOptions;
};

// Geometry and surface come from the `.yc-toast` recipe in globals.css (and the
// ToastContainer in ui/layout/ToastProvider), not from per-call utilities, so a
// toast raised anywhere in the app is the same toast.
const BASE_OPTIONS: ToastOptions = {
  closeButton: false,
  icon: false,
  hideProgressBar: true,
  className: 'yc-toast',
};

const TOAST_CONFIG: Record<NotifyType, ToastConfigItem> = {
  success: {
    show: toast.success,
    Component: Success,
  },
  error: {
    show: toast.error,
    Component: ErrorToast,
  },
  info: {
    show: toast.info,
    Component: InfoToast,
  },
  warning: {
    show: toast.warning,
    Component: WarningToast,
  },
};

export const useNotify = () => {
  // Memoised with no dependencies: `notify` closes over module constants only.
  // It used to be a fresh function on every render, so any useCallback that
  // listed it - and any effect depending on that callback - was recreated each
  // render. A loader like `useEffect(() => { load(); }, [load])` with
  // `load = useCallback(..., [notify])` therefore re-ran forever, hammering the
  // API and flickering the loading state.
  const notify = useCallback((type: NotifyType, data: NotifyData, overrides?: ToastOptions) => {
    const cfg = TOAST_CONFIG[type];

    cfg.show(cfg.Component, {
      ...BASE_OPTIONS,
      ...cfg.options,
      ...overrides,
      data,
    });
  }, []);

  return { notify };
};
