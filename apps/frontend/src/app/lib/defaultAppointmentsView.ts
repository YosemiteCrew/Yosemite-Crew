const DEFAULT_APPOINTMENTS_VIEW_STORAGE_KEY = 'yc_default_appointments_view';

export type DefaultAppointmentsView = 'calendar' | 'board' | 'list';

const hasWindow = () => globalThis.window !== undefined;

const isValidView = (value?: string | null): value is DefaultAppointmentsView =>
  value === 'calendar' || value === 'board' || value === 'list';

export const getSavedDefaultAppointmentsView = (): DefaultAppointmentsView | null => {
  if (!hasWindow()) return null;
  try {
    const saved = globalThis.window.localStorage.getItem(DEFAULT_APPOINTMENTS_VIEW_STORAGE_KEY);
    return isValidView(saved) ? saved : null;
  } catch {
    return null;
  }
};

export const setSavedDefaultAppointmentsView = (view: DefaultAppointmentsView | null): boolean => {
  if (!hasWindow()) return false;
  try {
    if (view == null) {
      globalThis.window.localStorage.removeItem(DEFAULT_APPOINTMENTS_VIEW_STORAGE_KEY);
    } else if (isValidView(view)) {
      globalThis.window.localStorage.setItem(DEFAULT_APPOINTMENTS_VIEW_STORAGE_KEY, view);
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const resolveDefaultAppointmentsView = (): DefaultAppointmentsView => {
  return getSavedDefaultAppointmentsView() ?? 'board';
};
