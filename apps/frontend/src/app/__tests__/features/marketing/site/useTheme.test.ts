import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '@/app/features/marketing/site/useTheme';

type MqListener = (event: { matches: boolean }) => void;

describe('useTheme', () => {
  let osListener: MqListener | null;

  const mockMatchMedia = (matches: boolean) => {
    osListener = null;
    (globalThis as { matchMedia: unknown }).matchMedia = jest.fn().mockReturnValue({
      matches,
      addEventListener: (_: string, handler: MqListener) => {
        osListener = handler;
      },
      removeEventListener: jest.fn(),
    });
  };

  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-ready');
    localStorage.clear();
    mockMatchMedia(false);
  });

  it('reads the initial theme from the html attribute', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('defaults to light when no attribute is set', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('server-renders the light default so hydration matches the server HTML', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    let ssrTheme: string | null = null;
    const Probe = () => {
      ssrTheme = useTheme().theme;
      return null;
    };
    renderToString(createElement(Probe));
    expect(ssrTheme).toBe('light');
  });

  it('toggle flips the theme, persists it, and dispatches yc-theme-change', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const seen: string[] = [];
    const onChange = ((event: Event) => {
      seen.push((event as CustomEvent<{ theme: string }>).detail.theme);
    }) as EventListener;
    globalThis.addEventListener('yc-theme-change', onChange);

    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme-ready')).toBe('1');
    expect(localStorage.getItem('yc-theme')).toBe('dark');
    expect(result.current.theme).toBe('dark');
    expect(seen).toContain('dark');
    globalThis.removeEventListener('yc-theme-change', onChange);
  });

  it('mirrors a yc-theme-change dispatched by another toggle instance', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const { result } = renderHook(() => useTheme());
    act(() => {
      // Another instance's applyTheme sets the html attribute, then broadcasts.
      document.documentElement.setAttribute('data-theme', 'dark');
      globalThis.dispatchEvent(new CustomEvent('yc-theme-change', { detail: { theme: 'dark' } }));
    });
    expect(result.current.theme).toBe('dark');
  });

  it('enables the flip transition shortly after mount', () => {
    jest.useFakeTimers();
    try {
      renderHook(() => useTheme());
      act(() => {
        jest.advanceTimersByTime(70);
      });
      expect(document.documentElement.getAttribute('data-theme-ready')).toBe('1');
    } finally {
      jest.useRealTimers();
    }
  });

  it('follows OS changes while no explicit choice is stored', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const { result } = renderHook(() => useTheme());
    act(() => osListener?.({ matches: true }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(result.current.theme).toBe('dark');
  });

  it('ignores OS changes once a choice is stored', () => {
    localStorage.setItem('yc-theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
    const { result } = renderHook(() => useTheme());
    act(() => osListener?.({ matches: true }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(result.current.theme).toBe('light');
  });

  it('sets a meta theme-color', () => {
    renderHook(() => useTheme());
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('content')).toBeTruthy();
  });

  it('still flips the theme when localStorage.setItem is blocked', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    spy.mockRestore();
  });

  it('applies the OS theme even when reading the stored choice throws', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderHook(() => useTheme());
    act(() => osListener?.({ matches: true }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    spy.mockRestore();
  });

  it('falls back to the html attribute for a detail-less theme-change event', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const { result } = renderHook(() => useTheme());
    act(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      globalThis.dispatchEvent(new Event('yc-theme-change'));
    });
    expect(result.current.theme).toBe('dark');
  });

  it('follows the OS back to light', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { result } = renderHook(() => useTheme());
    act(() => osListener?.({ matches: false }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(result.current.theme).toBe('light');
  });

  it('uses the resolved --page value for the meta theme-color when present', () => {
    document.documentElement.style.setProperty('--page', '#201c18');
    renderHook(() => useTheme());
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#201c18');
    document.documentElement.style.removeProperty('--page');
  });
});
