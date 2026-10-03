import { renderHook } from '@testing-library/react';
import { useAnnouncer } from '@/app/ui/primitives/VoiceCapture/useAnnouncer';

describe('useAnnouncer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does nothing when no live region is attached yet', () => {
    const { result } = renderHook(() => useAnnouncer());

    expect(() => {
      result.current.announce('Recording started');
      jest.runAllTimers();
    }).not.toThrow();
  });

  it('replaces the message so repeated announcements are re-read', () => {
    const region = document.createElement('output');
    document.body.appendChild(region);
    const { result } = renderHook(() => useAnnouncer(), {
      // Bind the hook's ref to a real element the way the panel does.
    });
    (result.current.liveRegionRef as { current: HTMLOutputElement | null }).current = region;

    result.current.announce('Recording started');
    jest.runAllTimers();
    expect(region.textContent).toBe('Recording started');

    result.current.announce('Recording complete');
    jest.runAllTimers();
    expect(region.textContent).toBe('Recording complete');

    document.body.removeChild(region);
  });

  it('cancels a pending announcement when the panel goes away', () => {
    const region = document.createElement('output');
    const { result, unmount } = renderHook(() => useAnnouncer());
    (result.current.liveRegionRef as { current: HTMLOutputElement | null }).current = region;

    result.current.announce('Recording started');
    unmount();

    expect(jest.getTimerCount()).toBe(0);
    expect(region.textContent).toBe('');
  });
});
