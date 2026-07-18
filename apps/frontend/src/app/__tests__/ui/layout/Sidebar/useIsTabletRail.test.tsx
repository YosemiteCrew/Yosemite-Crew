import { renderHook, act } from '@testing-library/react';
import { useIsTabletRail, TABLET_RAIL_MEDIA_QUERY } from '@/app/ui/layout/Sidebar/useIsTabletRail';

type MqListener = () => void;

type MockMql = {
  matches: boolean;
  media: string;
  addEventListener: (type: string, handler: MqListener) => void;
  removeEventListener: jest.Mock;
};

describe('useIsTabletRail', () => {
  let mql: MockMql;

  const mockMatchMedia = (matches: boolean) => {
    let listener: MqListener | null = null;
    mql = {
      matches,
      media: TABLET_RAIL_MEDIA_QUERY,
      addEventListener: (_type: string, handler: MqListener) => {
        listener = handler;
      },
      removeEventListener: jest.fn(),
    };
    (globalThis as { matchMedia: unknown }).matchMedia = jest.fn().mockReturnValue(mql);
    return {
      fireChange: (next: boolean) => {
        mql.matches = next;
        listener?.();
      },
    };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('targets the 768-1279px tablet band from the Foundations breakpoint contract', () => {
    expect(TABLET_RAIL_MEDIA_QUERY).toBe('(min-width: 768px) and (max-width: 1279px)');
  });

  it('returns false outside the tablet band', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsTabletRail());
    expect(result.current).toBe(false);
  });

  it('returns true when the tablet media query matches', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsTabletRail());
    expect(result.current).toBe(true);
  });

  it('updates when the media query change event fires', () => {
    const { fireChange } = mockMatchMedia(false);
    const { result } = renderHook(() => useIsTabletRail());
    expect(result.current).toBe(false);

    act(() => {
      fireChange(true);
    });
    expect(result.current).toBe(true);
  });

  it('removes the change listener on unmount', () => {
    mockMatchMedia(true);
    const { unmount } = renderHook(() => useIsTabletRail());
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('is a no-op when matchMedia is unavailable', () => {
    const original = globalThis.matchMedia;
    (globalThis as { matchMedia: unknown }).matchMedia = undefined;
    try {
      const { result } = renderHook(() => useIsTabletRail());
      expect(result.current).toBe(false);
    } finally {
      globalThis.matchMedia = original;
    }
  });
});
