import {
  AppointmentViewPreference,
  AnimalTerminologyPreference,
  DefaultOpenScreenPreference,
  PmsPreferences,
} from '@/app/features/users/types/profile';
import { DefaultAppointmentsView } from '@/app/lib/defaultAppointmentsView';
import { DefaultOpenScreenRoute } from '@/app/lib/defaultOpenScreen';
import { parseTimezoneFromProfileValue } from '@/app/lib/timezone';

export const DEFAULT_PMS_PREFERENCES: Required<PmsPreferences> = {
  defaultOpenScreen: 'APPOINTMENTS',
  appointmentView: 'STATUS_BOARD',
  animalTerminology: 'COMPANION',
};

export const getFallbackAnimalTerminology = (
  orgType?: string | null
): AnimalTerminologyPreference => {
  return String(orgType ?? '')
    .trim()
    .toUpperCase() === 'HOSPITAL'
    ? 'PATIENT'
    : 'COMPANION';
};

export const normalizePmsPreferences = (
  value?: PmsPreferences | null,
  orgType?: string | null
): Required<PmsPreferences> => {
  const fallbackAnimalTerminology = getFallbackAnimalTerminology(orgType);
  return {
    defaultOpenScreen: value?.defaultOpenScreen ?? DEFAULT_PMS_PREFERENCES.defaultOpenScreen,
    appointmentView: value?.appointmentView ?? DEFAULT_PMS_PREFERENCES.appointmentView,
    animalTerminology: value?.animalTerminology ?? fallbackAnimalTerminology,
  };
};

export const defaultOpenScreenToRoute = (
  value: DefaultOpenScreenPreference
): DefaultOpenScreenRoute => {
  return value === 'DASHBOARD' ? '/dashboard' : '/appointments';
};

export const routeToDefaultOpenScreen = (
  value: DefaultOpenScreenRoute
): DefaultOpenScreenPreference => {
  return value === '/dashboard' ? 'DASHBOARD' : 'APPOINTMENTS';
};

export const appointmentViewToLocal = (
  value: AppointmentViewPreference
): DefaultAppointmentsView => {
  if (value === 'CALENDAR') return 'calendar';
  if (value === 'TABLE') return 'list';
  return 'board';
};

export const localToAppointmentView = (
  value: DefaultAppointmentsView
): AppointmentViewPreference => {
  if (value === 'calendar') return 'CALENDAR';
  if (value === 'list') return 'TABLE';
  return 'STATUS_BOARD';
};

export const parseTimezoneFromProfile = (timezone?: string | null): string => {
  return parseTimezoneFromProfileValue(timezone);
};

const getUtcOffsetLabel = (timeZone: string): string => {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'shortOffset',
    });
    const parts = dtf.formatToParts(new Date());
    const raw = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
    return raw.replace('GMT', 'UTC');
  } catch {
    return 'UTC';
  }
};

export const serializeTimezoneForProfile = (timeZone: string): string => {
  return `${getUtcOffsetLabel(timeZone)} - ${timeZone}`;
};

export const isValidAnimalTerminology = (
  value?: string | null
): value is AnimalTerminologyPreference => {
  return value === 'ANIMAL' || value === 'COMPANION' || value === 'PET' || value === 'PATIENT';
};
