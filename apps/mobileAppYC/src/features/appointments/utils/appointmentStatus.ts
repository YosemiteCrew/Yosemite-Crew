import type {AppointmentStatus} from '@/features/appointments/types';

const normalizeStatus = (status?: string | null): string =>
  String(status ?? '')
    .trim()
    .toUpperCase()
    .replaceAll(/\s+/g, '_');

export const isAppointmentPaymentPending = (
  status?: string | null,
  paymentStatus?: string | null,
): boolean => {
  const normalizedStatus = normalizeStatus(status);
  const normalizedPaymentStatus = normalizeStatus(paymentStatus);
  return (
    normalizedPaymentStatus === 'UNPAID' ||
    normalizedPaymentStatus === 'PAYMENT_PENDING' ||
    normalizedPaymentStatus === 'AWAITING_PAYMENT' ||
    normalizedStatus === 'NO_PAYMENT' ||
    normalizedStatus === 'AWAITING_PAYMENT'
  );
};

export const isAppointmentPaymentFailed = (
  status?: string | null,
  paymentStatus?: string | null,
): boolean => {
  const normalizedStatus = normalizeStatus(status);
  const normalizedPaymentStatus = normalizeStatus(paymentStatus);
  return (
    normalizedStatus === 'PAYMENT_FAILED' ||
    normalizedPaymentStatus === 'PAYMENT_FAILED' ||
    normalizedPaymentStatus === 'FAILED' ||
    normalizedPaymentStatus === 'FAILURE' ||
    normalizedPaymentStatus === 'DECLINED'
  );
};

export const isTerminalAppointmentStatus = (
  status?: string | null,
): boolean => {
  const normalized = normalizeStatus(status);
  return (
    normalized === 'COMPLETED' ||
    normalized === 'CANCELLED' ||
    normalized === 'NO_SHOW'
  );
};

export const isActionableUpcomingStatus = (status?: string | null): boolean => {
  const normalized = normalizeStatus(status);
  return (
    normalized === 'UPCOMING' ||
    normalized === 'CONFIRMED' ||
    normalized === 'SCHEDULED' ||
    normalized === 'RESCHEDULED' ||
    normalized === 'CHECKED_IN' ||
    normalized === 'IN_PROGRESS'
  );
};

export const getAppointmentStatusLabel = (
  status?: string | null,
  paymentStatus?: string | null,
): string => {
  if (isAppointmentPaymentFailed(status, paymentStatus)) {
    return 'Payment failed';
  }

  if (isAppointmentPaymentPending(status, paymentStatus)) {
    return 'Payment pending';
  }

  const normalized = normalizeStatus(status);
  switch (normalized) {
    case 'UPCOMING':
      return 'Upcoming';
    case 'CHECKED_IN':
      return 'Checked in';
    case 'IN_PROGRESS':
      return 'In progress';
    case 'REQUESTED':
      return 'Requested';
    case 'PAID':
      return 'Paid';
    case 'CONFIRMED':
    case 'SCHEDULED':
      return 'Scheduled';
    case 'RESCHEDULED':
      return 'Rescheduled';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'PAYMENT_FAILED':
      return 'Payment failed';
    case 'NO_SHOW':
      return 'No show';
    default:
      return 'Unknown';
  }
};

type AppointmentTheme = {
  colors: {
    secondary: string;
    primary: string;
    primaryTint: string;
    success: string;
    successSurface: string;
    warning: string;
    warningSurface: string;
    error: string;
    errorSurface: string;
  };
};

export type AppointmentStatusBadgePalette = {
  text: string;
  textColor: string;
  backgroundColor: string;
};

export const getAppointmentStatusBadgePalette = (
  theme: AppointmentTheme,
  status?: string | null,
  paymentStatus?: string | null,
): AppointmentStatusBadgePalette => {
  const label = getAppointmentStatusLabel(status, paymentStatus);
  const normalizedStatus = normalizeStatus(status);

  if (isAppointmentPaymentFailed(status, paymentStatus)) {
    return {
      text: label,
      textColor: theme.colors.error,
      backgroundColor: theme.colors.errorSurface,
    };
  }

  if (isAppointmentPaymentPending(status, paymentStatus)) {
    return {
      text: label,
      textColor: theme.colors.warning,
      backgroundColor: theme.colors.warningSurface,
    };
  }

  switch (normalizedStatus) {
    case 'UPCOMING':
      return {
        text: label,
        textColor: theme.colors.secondary,
        backgroundColor: theme.colors.primaryTint,
      };
    case 'CHECKED_IN':
    case 'IN_PROGRESS':
    case 'PAID':
    case 'CONFIRMED':
    case 'SCHEDULED':
    case 'COMPLETED':
      return {
        text: label,
        textColor: theme.colors.success,
        backgroundColor: theme.colors.successSurface,
      };
    case 'REQUESTED':
      return {
        text: label,
        textColor: theme.colors.primary,
        backgroundColor: theme.colors.primaryTint,
      };
    case 'RESCHEDULED':
      return {
        text: label,
        textColor: theme.colors.warning,
        backgroundColor: theme.colors.warningSurface,
      };
    case 'CANCELLED':
    case 'NO_SHOW':
      return {
        text: label,
        textColor: theme.colors.error,
        backgroundColor: theme.colors.errorSurface,
      };
    default:
      return {
        text: label,
        textColor: theme.colors.secondary,
        backgroundColor: theme.colors.primaryTint,
      };
  }
};

export const normalizeAppointmentStatusForUi = (
  status?: string | null,
): AppointmentStatus | 'NO_SHOW' => {
  const normalized = normalizeStatus(status);
  if (normalized === 'NO_SHOW') {
    return 'NO_SHOW';
  }
  return (normalized || 'REQUESTED') as AppointmentStatus;
};
