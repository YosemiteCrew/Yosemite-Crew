export const isAppointmentRevampEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_APPOINTMENT_REVAMP === 'true';
