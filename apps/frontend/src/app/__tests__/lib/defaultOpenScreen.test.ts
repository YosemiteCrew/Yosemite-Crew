import {
  getRoleDefaultOpenScreenRoute,
  getSavedDefaultOpenScreenRoute,
  setSavedDefaultOpenScreenRoute,
  resolveDefaultOpenScreenRoute,
} from '@/app/lib/defaultOpenScreen';

const STORAGE_KEY = 'yc_default_open_screen';

beforeEach(() => {
  window.localStorage.clear();
});

describe('getRoleDefaultOpenScreenRoute', () => {
  it('returns /dashboard for owner role', () => {
    expect(getRoleDefaultOpenScreenRoute('owner')).toBe('/dashboard');
    expect(getRoleDefaultOpenScreenRoute('OWNER')).toBe('/dashboard');
  });

  it('returns /appointments for non-owner roles', () => {
    expect(getRoleDefaultOpenScreenRoute('ADMIN')).toBe('/appointments');
    expect(getRoleDefaultOpenScreenRoute('MEMBER')).toBe('/appointments');
  });

  it('returns /appointments for null', () => {
    expect(getRoleDefaultOpenScreenRoute(null)).toBe('/appointments');
  });

  it('returns /appointments for undefined', () => {
    expect(getRoleDefaultOpenScreenRoute(undefined)).toBe('/appointments');
  });
});

describe('getSavedDefaultOpenScreenRoute', () => {
  it('returns null when nothing is saved', () => {
    expect(getSavedDefaultOpenScreenRoute()).toBeNull();
  });

  it('returns /dashboard when saved', () => {
    window.localStorage.setItem(STORAGE_KEY, '/dashboard');
    expect(getSavedDefaultOpenScreenRoute()).toBe('/dashboard');
  });

  it('returns /appointments when saved', () => {
    window.localStorage.setItem(STORAGE_KEY, '/appointments');
    expect(getSavedDefaultOpenScreenRoute()).toBe('/appointments');
  });

  it('returns null for invalid saved value', () => {
    window.localStorage.setItem(STORAGE_KEY, '/invalid');
    expect(getSavedDefaultOpenScreenRoute()).toBeNull();
  });
});

describe('setSavedDefaultOpenScreenRoute', () => {
  it('saves /dashboard and returns true', () => {
    expect(setSavedDefaultOpenScreenRoute('/dashboard')).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('/dashboard');
  });

  it('saves /appointments and returns true', () => {
    expect(setSavedDefaultOpenScreenRoute('/appointments')).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('/appointments');
  });

  it('removes saved route when null is passed', () => {
    window.localStorage.setItem(STORAGE_KEY, '/dashboard');
    expect(setSavedDefaultOpenScreenRoute(null)).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('dispatches a custom event when saving', () => {
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    setSavedDefaultOpenScreenRoute('/dashboard');
    expect(dispatchSpy).toHaveBeenCalled();
    dispatchSpy.mockRestore();
  });

  it('returns false for an invalid route value', () => {
    const result = setSavedDefaultOpenScreenRoute('/invalid-route' as any);
    expect(result).toBe(false);
    expect(window.localStorage.getItem('yc_default_open_screen')).toBeNull();
  });
});

describe('resolveDefaultOpenScreenRoute', () => {
  it('returns role-based default when nothing is saved (non-owner)', () => {
    expect(resolveDefaultOpenScreenRoute('ADMIN')).toBe('/appointments');
  });

  it('returns /dashboard for owner when nothing saved', () => {
    expect(resolveDefaultOpenScreenRoute('owner')).toBe('/dashboard');
  });

  it('returns saved route regardless of role', () => {
    setSavedDefaultOpenScreenRoute('/dashboard');
    expect(resolveDefaultOpenScreenRoute('ADMIN')).toBe('/dashboard');
  });
});
