import { renderHook, act } from '@testing-library/react';
import {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  applyTheme,
  getServerTheme,
  readTheme,
  subscribeToThemeChange,
  syncMetaThemeColor,
  toggleTheme,
  useThemeLifecycle,
} from '@/app/ui/theme/themeCore';

type MqListener = (event: { matches: boolean }) => void;

describe('themeCore', () => {
  let osListener: MqListener | null;
  let mqRemoveListener: jest.Mock;

  const mockMatchMedia = (matches: boolean) => {
    osListener = null;
    mqRemoveListener = jest.fn();
    (globalThis as { matchMedia: unknown }).matchMedia = jest.fn().mockReturnValue({
      matches,
      addEventListener: (_: string, handler: MqListener) => {
        osListener = handler;
      },
      removeEventListener: mqRemoveListener,
    });
  };

  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-ready');
    document.querySelector('meta[name="theme-color"]')?.remove();
    localStorage.clear();
    mockMatchMedia(false);
  });

  it('exposes the shared storage key and change event names', () => {
    expect(THEME_STORAGE_KEY).toBe('yc-theme');
    expect(THEME_CHANGE_EVENT).toBe('yc-theme-change');
  });

  describe('readTheme / getServerTheme', () => {
    it('reads dark from the html attribute', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      expect(readTheme()).toBe('dark');
    });

    it('defaults to light when the attribute is absent', () => {
      expect(readTheme()).toBe('light');
    });

    it('always reports light for the server snapshot', () => {
      expect(getServerTheme()).toBe('light');
    });
  });

  describe('syncMetaThemeColor', () => {
    it('creates the meta tag and fills the light fallback color', () => {
      syncMetaThemeColor();
      const meta = document.querySelector('meta[name="theme-color"]');
      expect(meta?.getAttribute('content')).toBe('#efe8dc');
    });

    it('uses the dark fallback color when the theme is dark', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      syncMetaThemeColor();
      const meta = document.querySelector('meta[name="theme-color"]');
      expect(meta?.getAttribute('content')).toBe('#201c18');
    });

    it('prefers the resolved --page custom property when present', () => {
      document.documentElement.style.setProperty('--page', '#123456');
      syncMetaThemeColor();
      const meta = document.querySelector('meta[name="theme-color"]');
      expect(meta?.getAttribute('content')).toBe('#123456');
      document.documentElement.style.removeProperty('--page');
    });

    it('reuses an existing meta tag instead of creating a second one', () => {
      syncMetaThemeColor();
      syncMetaThemeColor();
      expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    });
  });

  describe('applyTheme', () => {
    it('sets the attribute, persists the choice, and broadcasts the change', () => {
      const seen: string[] = [];
      const onChange = ((event: Event) => {
        seen.push((event as CustomEvent<{ theme: string }>).detail.theme);
      }) as EventListener;
      globalThis.addEventListener(THEME_CHANGE_EVENT, onChange);

      applyTheme('dark', true);

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme-ready')).toBe('1');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
      expect(seen).toContain('dark');
      globalThis.removeEventListener(THEME_CHANGE_EVENT, onChange);
    });

    it('does not persist when persist is false', () => {
      applyTheme('dark', false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });

    it('still applies the theme when localStorage.setItem is blocked', () => {
      const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      applyTheme('dark', true);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      spy.mockRestore();
    });
  });

  describe('toggleTheme', () => {
    it('flips light to dark and persists the choice', () => {
      document.documentElement.setAttribute('data-theme', 'light');
      toggleTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });

    it('flips dark back to light', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      toggleTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    });
  });

  describe('subscribeToThemeChange', () => {
    it('notifies while subscribed and stops after unsubscribe', () => {
      const onStoreChange = jest.fn();
      const unsubscribe = subscribeToThemeChange(onStoreChange);

      globalThis.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      expect(onStoreChange).toHaveBeenCalledTimes(1);

      unsubscribe();
      globalThis.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      expect(onStoreChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('useThemeLifecycle', () => {
    it('enables the flip transition shortly after mount', () => {
      jest.useFakeTimers();
      try {
        renderHook(() => useThemeLifecycle());
        act(() => {
          jest.advanceTimersByTime(70);
        });
        expect(document.documentElement.getAttribute('data-theme-ready')).toBe('1');
      } finally {
        jest.useRealTimers();
      }
    });

    it('syncs the meta theme-color on mount', () => {
      renderHook(() => useThemeLifecycle());
      expect(document.querySelector('meta[name="theme-color"]')).not.toBeNull();
    });

    it('follows OS changes while no explicit choice is stored', () => {
      document.documentElement.setAttribute('data-theme', 'light');
      renderHook(() => useThemeLifecycle());
      act(() => osListener?.({ matches: true }));
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('follows the OS back to light', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      renderHook(() => useThemeLifecycle());
      act(() => osListener?.({ matches: false }));
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('ignores OS changes once a choice is stored', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
      document.documentElement.setAttribute('data-theme', 'light');
      renderHook(() => useThemeLifecycle());
      act(() => osListener?.({ matches: true }));
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('applies the OS theme even when reading the stored choice throws', () => {
      document.documentElement.setAttribute('data-theme', 'light');
      const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      renderHook(() => useThemeLifecycle());
      act(() => osListener?.({ matches: true }));
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      spy.mockRestore();
    });

    it('stops following the OS after unmount', () => {
      const { unmount } = renderHook(() => useThemeLifecycle());
      unmount();
      expect(mqRemoveListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('mounts and unmounts cleanly when matchMedia is unavailable', () => {
      (globalThis as { matchMedia?: unknown }).matchMedia = undefined;
      expect(() => {
        const { unmount } = renderHook(() => useThemeLifecycle());
        unmount();
      }).not.toThrow();
    });
  });
});
