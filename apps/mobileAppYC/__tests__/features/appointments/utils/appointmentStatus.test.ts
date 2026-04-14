import {
  isAppointmentPaymentPending,
  isAppointmentPaymentFailed,
  isTerminalAppointmentStatus,
  isActionableUpcomingStatus,
  getAppointmentStatusLabel,
  getAppointmentStatusBadgePalette,
  normalizeAppointmentStatusForUi,
} from '@/features/appointments/utils/appointmentStatus';

const mockTheme = {
  colors: {
    secondary: '#secondary',
    primary: '#primary',
    primaryTint: '#primaryTint',
    success: '#success',
    successSurface: '#successSurface',
    warning: '#warning',
    warningSurface: '#warningSurface',
    error: '#error',
    errorSurface: '#errorSurface',
  },
};

describe('isAppointmentPaymentPending', () => {
  it('returns true for UNPAID paymentStatus', () => {
    expect(isAppointmentPaymentPending(null, 'UNPAID')).toBe(true);
  });

  it('returns true for PAYMENT_PENDING paymentStatus', () => {
    expect(isAppointmentPaymentPending(null, 'PAYMENT_PENDING')).toBe(true);
  });

  it('returns true for AWAITING_PAYMENT paymentStatus', () => {
    expect(isAppointmentPaymentPending(null, 'AWAITING_PAYMENT')).toBe(true);
  });

  it('returns true for NO_PAYMENT status', () => {
    expect(isAppointmentPaymentPending('NO_PAYMENT', null)).toBe(true);
  });

  it('returns true for AWAITING_PAYMENT status', () => {
    expect(isAppointmentPaymentPending('AWAITING_PAYMENT', null)).toBe(true);
  });

  it('returns false for non-pending status', () => {
    expect(isAppointmentPaymentPending('CONFIRMED', 'PAID')).toBe(false);
  });

  it('handles null/undefined inputs', () => {
    expect(isAppointmentPaymentPending(null, null)).toBe(false);
    expect(isAppointmentPaymentPending(undefined, undefined)).toBe(false);
  });

  it('normalizes whitespace and case', () => {
    expect(isAppointmentPaymentPending(null, '  unpaid  ')).toBe(true);
  });
});

describe('isAppointmentPaymentFailed', () => {
  it('returns true for PAYMENT_FAILED status', () => {
    expect(isAppointmentPaymentFailed('PAYMENT_FAILED', null)).toBe(true);
  });

  it('returns true for PAYMENT_FAILED paymentStatus', () => {
    expect(isAppointmentPaymentFailed(null, 'PAYMENT_FAILED')).toBe(true);
  });

  it('returns true for FAILED paymentStatus', () => {
    expect(isAppointmentPaymentFailed(null, 'FAILED')).toBe(true);
  });

  it('returns true for FAILURE paymentStatus', () => {
    expect(isAppointmentPaymentFailed(null, 'FAILURE')).toBe(true);
  });

  it('returns true for DECLINED paymentStatus', () => {
    expect(isAppointmentPaymentFailed(null, 'DECLINED')).toBe(true);
  });

  it('returns false for non-failed status', () => {
    expect(isAppointmentPaymentFailed('CONFIRMED', 'PAID')).toBe(false);
  });

  it('handles null/undefined inputs', () => {
    expect(isAppointmentPaymentFailed(null, null)).toBe(false);
  });
});

describe('isTerminalAppointmentStatus', () => {
  it.each([['COMPLETED'], ['CANCELLED'], ['NO_SHOW']])(
    'returns true for %s',
    status => {
      expect(isTerminalAppointmentStatus(status)).toBe(true);
    },
  );

  it('returns false for non-terminal status', () => {
    expect(isTerminalAppointmentStatus('UPCOMING')).toBe(false);
    expect(isTerminalAppointmentStatus('CONFIRMED')).toBe(false);
  });

  it('handles null/undefined', () => {
    expect(isTerminalAppointmentStatus(null)).toBe(false);
    expect(isTerminalAppointmentStatus(undefined)).toBe(false);
  });
});

describe('isActionableUpcomingStatus', () => {
  it.each([
    ['UPCOMING'],
    ['CONFIRMED'],
    ['SCHEDULED'],
    ['RESCHEDULED'],
    ['CHECKED_IN'],
    ['IN_PROGRESS'],
  ])('returns true for %s', status => {
    expect(isActionableUpcomingStatus(status)).toBe(true);
  });

  it('returns false for terminal statuses', () => {
    expect(isActionableUpcomingStatus('COMPLETED')).toBe(false);
    expect(isActionableUpcomingStatus('CANCELLED')).toBe(false);
  });

  it('handles null/undefined', () => {
    expect(isActionableUpcomingStatus(null)).toBe(false);
    expect(isActionableUpcomingStatus(undefined)).toBe(false);
  });
});

describe('getAppointmentStatusLabel', () => {
  it('returns "Payment failed" when payment failed', () => {
    expect(getAppointmentStatusLabel('PAYMENT_FAILED', null)).toBe(
      'Payment failed',
    );
  });

  it('returns "Payment pending" when payment pending', () => {
    expect(getAppointmentStatusLabel(null, 'UNPAID')).toBe('Payment pending');
  });

  it.each([
    ['UPCOMING', 'Upcoming'],
    ['CHECKED_IN', 'Checked in'],
    ['IN_PROGRESS', 'In progress'],
    ['REQUESTED', 'Requested'],
    ['PAID', 'Paid'],
    ['CONFIRMED', 'Scheduled'],
    ['SCHEDULED', 'Scheduled'],
    ['RESCHEDULED', 'Rescheduled'],
    ['COMPLETED', 'Completed'],
    ['CANCELLED', 'Cancelled'],
    ['PAYMENT_FAILED', 'Payment failed'],
    ['NO_SHOW', 'No show'],
  ])('returns correct label for %s', (status, expected) => {
    expect(getAppointmentStatusLabel(status, null)).toBe(expected);
  });

  it('returns "Unknown" for unrecognized status', () => {
    expect(getAppointmentStatusLabel('FOOBAR', null)).toBe('Unknown');
  });

  it('handles null/undefined', () => {
    expect(getAppointmentStatusLabel(null, null)).toBe('Unknown');
  });
});

describe('getAppointmentStatusBadgePalette', () => {
  it('returns error palette for payment failed', () => {
    const result = getAppointmentStatusBadgePalette(
      mockTheme,
      'PAYMENT_FAILED',
      null,
    );
    expect(result.textColor).toBe('#error');
    expect(result.backgroundColor).toBe('#errorSurface');
    expect(result.text).toBe('Payment failed');
  });

  it('returns warning palette for payment pending (UNPAID paymentStatus)', () => {
    const result = getAppointmentStatusBadgePalette(mockTheme, null, 'UNPAID');
    expect(result.textColor).toBe('#warning');
    expect(result.backgroundColor).toBe('#warningSurface');
    expect(result.text).toBe('Payment pending');
  });

  it('returns success palette for CHECKED_IN', () => {
    const result = getAppointmentStatusBadgePalette(
      mockTheme,
      'CHECKED_IN',
      null,
    );
    expect(result.textColor).toBe('#success');
    expect(result.backgroundColor).toBe('#successSurface');
  });

  it('returns success palette for IN_PROGRESS', () => {
    const result = getAppointmentStatusBadgePalette(
      mockTheme,
      'IN_PROGRESS',
      null,
    );
    expect(result.textColor).toBe('#success');
  });

  it('returns success palette for PAID', () => {
    const result = getAppointmentStatusBadgePalette(mockTheme, 'PAID', null);
    expect(result.textColor).toBe('#success');
  });

  it('returns success palette for CONFIRMED', () => {
    const result = getAppointmentStatusBadgePalette(
      mockTheme,
      'CONFIRMED',
      null,
    );
    expect(result.textColor).toBe('#success');
  });

  it('returns success palette for SCHEDULED', () => {
    const result = getAppointmentStatusBadgePalette(
      mockTheme,
      'SCHEDULED',
      null,
    );
    expect(result.textColor).toBe('#success');
  });

  it('returns success palette for COMPLETED', () => {
    const result = getAppointmentStatusBadgePalette(
      mockTheme,
      'COMPLETED',
      null,
    );
    expect(result.textColor).toBe('#success');
  });

  it('returns primary palette for REQUESTED', () => {
    const result = getAppointmentStatusBadgePalette(
      mockTheme,
      'REQUESTED',
      null,
    );
    expect(result.textColor).toBe('#primary');
    expect(result.backgroundColor).toBe('#primaryTint');
  });

  it('returns warning palette for RESCHEDULED', () => {
    const result = getAppointmentStatusBadgePalette(
      mockTheme,
      'RESCHEDULED',
      null,
    );
    expect(result.textColor).toBe('#warning');
    expect(result.backgroundColor).toBe('#warningSurface');
  });

  it('returns error palette for CANCELLED', () => {
    const result = getAppointmentStatusBadgePalette(
      mockTheme,
      'CANCELLED',
      null,
    );
    expect(result.textColor).toBe('#error');
    expect(result.backgroundColor).toBe('#errorSurface');
  });

  it('returns error palette for NO_SHOW', () => {
    const result = getAppointmentStatusBadgePalette(mockTheme, 'NO_SHOW', null);
    expect(result.textColor).toBe('#error');
    expect(result.backgroundColor).toBe('#errorSurface');
  });

  it('returns secondary/primaryTint for UPCOMING (falls to default)', () => {
    const result = getAppointmentStatusBadgePalette(
      mockTheme,
      'UPCOMING',
      null,
    );
    expect(result.textColor).toBe('#secondary');
    expect(result.backgroundColor).toBe('#primaryTint');
  });

  it('returns secondary/primaryTint for unknown status (default)', () => {
    const result = getAppointmentStatusBadgePalette(mockTheme, 'FOOBAR', null);
    expect(result.textColor).toBe('#secondary');
    expect(result.backgroundColor).toBe('#primaryTint');
  });
});

describe('normalizeAppointmentStatusForUi', () => {
  it('returns NO_SHOW for no show status', () => {
    expect(normalizeAppointmentStatusForUi('NO_SHOW')).toBe('NO_SHOW');
  });

  it('returns normalized status for valid statuses', () => {
    expect(normalizeAppointmentStatusForUi('confirmed')).toBe('CONFIRMED');
    expect(normalizeAppointmentStatusForUi('UPCOMING')).toBe('UPCOMING');
  });

  it('returns REQUESTED as fallback for empty/null/undefined', () => {
    expect(normalizeAppointmentStatusForUi(null)).toBe('REQUESTED');
    expect(normalizeAppointmentStatusForUi(undefined)).toBe('REQUESTED');
    expect(normalizeAppointmentStatusForUi('')).toBe('REQUESTED');
  });
});
