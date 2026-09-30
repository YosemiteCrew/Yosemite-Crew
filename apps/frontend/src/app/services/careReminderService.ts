import { getData, postData } from '@/app/services/axios';

export type CareReminderType =
  | 'VACCINATION_BOOSTER'
  | 'ANNUAL_CHECKUP'
  | 'PARASITE_TREATMENT'
  | 'DENTAL_CLEANING'
  | 'FOLLOW_UP'
  | 'CUSTOM';

export type CareReminderStatus =
  'PENDING' | 'SENDING' | 'SENT' | 'RESPONDED' | 'EXPIRED' | 'CANCELLED';

export type CareReminderDelivery = {
  push: 'delivered' | 'failed' | 'suppressed' | 'unreachable';
  email: 'delivered' | 'failed' | 'suppressed' | 'unreachable';
};

export type CareReminder = {
  id: string;
  patientId: string;
  reminderType: CareReminderType;
  dueDate: string;
  sendAt: string | null;
  status: CareReminderStatus;
  sendingAt: string | null;
  lastAttemptAt: string | null;
  lastDelivery: CareReminderDelivery | null;
};

const base = (organisationId: string) =>
  `/v1/pms/organisation/${encodeURIComponent(organisationId)}/care-reminders`;

export const listCareReminders = async (organisationId: string): Promise<CareReminder[]> => {
  const response = await getData<CareReminder[]>(base(organisationId));
  return response.data;
};

export const createCareReminders = async (
  organisationId: string,
  input: {
    patientIds: string[];
    reminderType: CareReminderType;
    dueDate: string;
    sendAt?: string;
  }
): Promise<{ created: number }> => {
  const response = await postData<{ created: number }, typeof input>(
    `${base(organisationId)}/bulk`,
    input
  );
  return response.data;
};

export const sendCareReminder = async (
  organisationId: string,
  reminderId: string
): Promise<CareReminder> => {
  const response = await postData<CareReminder, Record<string, never>>(
    `${base(organisationId)}/${encodeURIComponent(reminderId)}/send`,
    {}
  );
  return response.data;
};
