import { getStorageItem, removeStorageItem, setStorageItem } from '@/app/lib/browserStorage';

const DEFAULT_APPOINTMENTS_VIEW_STORAGE_KEY = 'yc_default_appointments_view';

export type DefaultAppointmentsView = 'calendar' | 'board' | 'list';

const isValidView = (value?: string | null): value is DefaultAppointmentsView =>
  value === 'calendar' || value === 'board' || value === 'list';

export const getSavedDefaultAppointmentsView = (): DefaultAppointmentsView | null => {
  const saved = getStorageItem('local', DEFAULT_APPOINTMENTS_VIEW_STORAGE_KEY);
  return isValidView(saved) ? saved : null;
};

export const setSavedDefaultAppointmentsView = (view: DefaultAppointmentsView | null): boolean => {
  if (view == null) {
    return removeStorageItem('local', DEFAULT_APPOINTMENTS_VIEW_STORAGE_KEY);
  }
  if (!isValidView(view)) return false;
  return setStorageItem('local', DEFAULT_APPOINTMENTS_VIEW_STORAGE_KEY, view);
};

export const resolveDefaultAppointmentsView = (): DefaultAppointmentsView => {
  return getSavedDefaultAppointmentsView() ?? 'calendar';
};
