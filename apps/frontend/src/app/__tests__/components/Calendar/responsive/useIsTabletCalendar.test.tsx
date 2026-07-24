import { renderHook, act } from '@testing-library/react';

import useIsTabletCalendar, {
  TABLET_CALENDAR_MEDIA_QUERY,
} from '@/app/features/appointments/components/Calendar/responsive/useIsTabletCalendar';

type Listener = () => void;

const installMatchMedia = (matches: boolean) => {
  const listeners = new Set<Listener>();
  const mediaQueryList = {
    matches,
    addEventListener: (_: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
  };
  const matchMedia = jest.fn(() => mediaQueryList);
  (globalThis as { matchMedia: unknown }).matchMedia = matchMedia;

  return {
    matchMedia,
    setMatches: (next: boolean) => {
      mediaQueryList.matches = next;
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
};

describe('useIsTabletCalendar', () => {
  afterEach(() => {
    (globalThis as { matchMedia?: unknown }).matchMedia = undefined;
    jest.clearAllMocks();
  });

  it('gates on 768–1023px, leaving phone and desktop untouched', () => {
    expect(TABLET_CALENDAR_MEDIA_QUERY).toBe('(min-width: 768px) and (max-width: 1023px)');
  });

  it('reports true inside the band after mount', () => {
    const media = installMatchMedia(true);
    const { result } = renderHook(() => useIsTabletCalendar());

    expect(media.matchMedia).toHaveBeenCalledWith(TABLET_CALENDAR_MEDIA_QUERY);
    expect(result.current).toBe(true);
  });

  it('reports false outside the band', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useIsTabletCalendar());

    expect(result.current).toBe(false);
  });

  it('follows viewport changes', () => {
    const media = installMatchMedia(false);
    const { result } = renderHook(() => useIsTabletCalendar());

    act(() => media.setMatches(true));
    expect(result.current).toBe(true);

    act(() => media.setMatches(false));
    expect(result.current).toBe(false);
  });

  it('detaches its listener on unmount', () => {
    const media = installMatchMedia(true);
    const { unmount } = renderHook(() => useIsTabletCalendar());

    expect(media.listenerCount()).toBe(1);
    unmount();
    expect(media.listenerCount()).toBe(0);
  });

  it('stays false when the environment has no matchMedia', () => {
    (globalThis as { matchMedia?: unknown }).matchMedia = undefined;
    const { result } = renderHook(() => useIsTabletCalendar());

    expect(result.current).toBe(false);
  });
});
