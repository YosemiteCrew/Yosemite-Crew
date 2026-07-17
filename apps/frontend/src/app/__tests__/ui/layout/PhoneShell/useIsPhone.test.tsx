import { renderHook, act } from '@testing-library/react';
import { useIsPhone, PHONE_MEDIA_QUERY } from '@/app/ui/layout/PhoneShell/useIsPhone';

type MqListener = () => void;

type MockMql = {
  matches: boolean;
  media: string;
  addEventListener: (type: string, handler: MqListener) => void;
  removeEventListener: jest.Mock;
};

describe('useIsPhone', () => {
  let mql: MockMql;

  const mockMatchMedia = (matches: boolean) => {
    let listener: MqListener | null = null;
    mql = {
      matches,
      media: PHONE_MEDIA_QUERY,
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

  it('returns false when the viewport is wider than the phone breakpoint', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(false);
  });

  it('returns true when the phone media query matches', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(true);
  });

  it('updates when the media query change event fires', () => {
    const { fireChange } = mockMatchMedia(false);
    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(false);

    act(() => {
      fireChange(true);
    });
    expect(result.current).toBe(true);
  });

  it('removes the change listener on unmount', () => {
    mockMatchMedia(true);
    const { unmount } = renderHook(() => useIsPhone());
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('is a no-op when matchMedia is unavailable', () => {
    const original = globalThis.matchMedia;
    (globalThis as { matchMedia: unknown }).matchMedia = undefined;
    try {
      const { result } = renderHook(() => useIsPhone());
      expect(result.current).toBe(false);
    } finally {
      globalThis.matchMedia = original;
    }
  });
});
