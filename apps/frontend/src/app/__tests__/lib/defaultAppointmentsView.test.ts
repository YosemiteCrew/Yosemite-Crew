import {
  getSavedDefaultAppointmentsView,
  setSavedDefaultAppointmentsView,
  resolveDefaultAppointmentsView,
} from '@/app/lib/defaultAppointmentsView';

const STORAGE_KEY = 'yc_default_appointments_view';

beforeEach(() => {
  window.localStorage.clear();
});

describe('getSavedDefaultAppointmentsView', () => {
  it('returns null when nothing is saved', () => {
    expect(getSavedDefaultAppointmentsView()).toBeNull();
  });

  it('returns saved valid view', () => {
    window.localStorage.setItem(STORAGE_KEY, 'calendar');
    expect(getSavedDefaultAppointmentsView()).toBe('calendar');
  });

  it('returns null for invalid saved value', () => {
    window.localStorage.setItem(STORAGE_KEY, 'invalid');
    expect(getSavedDefaultAppointmentsView()).toBeNull();
  });

  it('returns board view when saved', () => {
    window.localStorage.setItem(STORAGE_KEY, 'board');
    expect(getSavedDefaultAppointmentsView()).toBe('board');
  });

  it('returns list view when saved', () => {
    window.localStorage.setItem(STORAGE_KEY, 'list');
    expect(getSavedDefaultAppointmentsView()).toBe('list');
  });
});

describe('setSavedDefaultAppointmentsView', () => {
  it('saves a valid view and returns true', () => {
    expect(setSavedDefaultAppointmentsView('calendar')).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('calendar');
  });

  it('saves board view', () => {
    expect(setSavedDefaultAppointmentsView('board')).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('board');
  });

  it('removes the saved view when null is passed', () => {
    window.localStorage.setItem(STORAGE_KEY, 'calendar');
    expect(setSavedDefaultAppointmentsView(null)).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('can overwrite an existing saved view', () => {
    setSavedDefaultAppointmentsView('calendar');
    setSavedDefaultAppointmentsView('list');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('list');
  });
});

describe('resolveDefaultAppointmentsView', () => {
  it('returns "board" when nothing is saved', () => {
    expect(resolveDefaultAppointmentsView()).toBe('board');
  });

  it('returns the saved view when available', () => {
    setSavedDefaultAppointmentsView('calendar');
    expect(resolveDefaultAppointmentsView()).toBe('calendar');
  });
});
