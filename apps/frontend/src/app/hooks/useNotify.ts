import { toast, ToastOptions } from "react-toastify";
import ErrorToast from "../ui/widgets/Toast/ErrorToast";
import InfoToast from "../ui/widgets/Toast/Info";
import WarningToast from "../ui/widgets/Toast/Warning";
import Success from "../ui/widgets/Toast/Success";

export type NotifyType = "success" | "error" | "info" | "warning";

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

const BASE_OPTIONS: ToastOptions = {
  closeButton: false,
  icon: false,
  hideProgressBar: true,
  className: "pl-5! pr-3! py-4! w-[400px]! rounded-2xl! shadow-0!",
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
  const notify = (
    type: NotifyType,
    data: NotifyData,
    overrides?: ToastOptions,
  ) => {
    const cfg = TOAST_CONFIG[type];

    cfg.show(cfg.Component, {
      ...BASE_OPTIONS,
      ...cfg.options,
      ...overrides,
      data,
    });
  };

  return { notify };
};
