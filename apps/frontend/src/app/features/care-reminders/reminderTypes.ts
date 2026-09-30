import type { CareReminderType } from '@/app/services/careReminderService';

export const REMINDER_TYPES: Array<{ value: CareReminderType; label: string }> = [
  { value: 'VACCINATION_BOOSTER', label: 'Vaccination booster' },
  { value: 'ANNUAL_CHECKUP', label: 'Annual check-up' },
  { value: 'PARASITE_TREATMENT', label: 'Parasite treatment' },
  { value: 'DENTAL_CLEANING', label: 'Dental cleaning' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'CUSTOM', label: 'Other care' },
];
