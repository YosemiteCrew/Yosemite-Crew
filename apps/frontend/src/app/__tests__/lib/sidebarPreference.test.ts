import {
  isSidebarCollapsedByDefault,
  resetSidebarPreference,
  setSidebarCollapsedPreference,
  SIDEBAR_COLLAPSED_KEY,
} from '@/app/lib/sidebarPreference';

const setWidth = (width: number) => {
  Object.defineProperty(globalThis.window, 'innerWidth', {
    value: width,
    configurable: true,
    writable: true,
  });
};

describe('sidebarPreference', () => {
  beforeEach(() => {
    globalThis.window.localStorage.clear();
    setWidth(1440);
  });

  it('defaults to expanded on desktop widths when no preference exists', () => {
    setWidth(1440);
    expect(isSidebarCollapsedByDefault()).toBe(false);
  });

  it('defaults to the collapsed rail on tablet widths when no preference exists', () => {
    setWidth(1024);
    expect(isSidebarCollapsedByDefault()).toBe(true);
  });

  it('reads persisted preferences regardless of viewport width', () => {
    setWidth(1024);
    globalThis.window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '0');
    expect(isSidebarCollapsedByDefault()).toBe(false);

    setWidth(1440);
    globalThis.window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1');
    expect(isSidebarCollapsedByDefault()).toBe(true);
  });

  it('falls back to expanded when the viewport width is unavailable', () => {
    Object.defineProperty(globalThis.window, 'innerWidth', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(isSidebarCollapsedByDefault()).toBe(false);
  });

  it('writes the collapsed preference', () => {
    setSidebarCollapsedPreference(false);
    expect(globalThis.window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('0');

    setSidebarCollapsedPreference(true);
    expect(globalThis.window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('1');
  });

  it('resets the preference so the viewport-aware default applies again', () => {
    setSidebarCollapsedPreference(true);
    resetSidebarPreference();
    expect(globalThis.window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBeNull();
  });
});
