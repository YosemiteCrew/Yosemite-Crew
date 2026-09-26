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

  describe('when storage refuses the write', () => {
    const refuseWrites = () => {
      const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      return () => setItem.mockRestore();
    };
    let restoreWrites: () => void = () => undefined;

    afterEach(() => {
      restoreWrites();
      resetSidebarPreference();
    });

    it('keeps the choice for this page, even over an older stored value', () => {
      globalThis.window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '0');
      restoreWrites = refuseWrites();

      setSidebarCollapsedPreference(true);

      expect(isSidebarCollapsedByDefault()).toBe(true);
    });

    it('drops the unsaved choice on reset, back to the viewport default', () => {
      restoreWrites = refuseWrites();
      setSidebarCollapsedPreference(true);

      resetSidebarPreference();

      expect(isSidebarCollapsedByDefault()).toBe(false);
    });

    it('lets stored values lead again once a write succeeds', () => {
      restoreWrites = refuseWrites();
      setSidebarCollapsedPreference(true);
      restoreWrites();

      setSidebarCollapsedPreference(false);
      // Another tab collapses it later; storage is the source of truth again.
      globalThis.window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1');

      expect(isSidebarCollapsedByDefault()).toBe(true);
    });
  });
});
