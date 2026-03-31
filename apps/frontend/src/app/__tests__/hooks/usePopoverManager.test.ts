import { renderHook, act } from '@testing-library/react';
import { usePopoverManager } from '@/app/hooks/usePopoverManager';

describe('usePopoverManager', () => {
  it('starts with null activePopoverKey', () => {
    const { result } = renderHook(() => usePopoverManager());
    expect(result.current.activePopoverKey).toBeNull();
  });

  it('starts with null activeRect', () => {
    const { result } = renderHook(() => usePopoverManager());
    expect(result.current.activeRect).toBeNull();
  });

  it('starts with null activeCursor', () => {
    const { result } = renderHook(() => usePopoverManager());
    expect(result.current.activeCursor).toBeNull();
  });

  it('exposes popoverDialogRef', () => {
    const { result } = renderHook(() => usePopoverManager());
    expect(result.current.popoverDialogRef).toBeDefined();
  });

  it('openPopover sets activePopoverKey', () => {
    const { result } = renderHook(() => usePopoverManager());

    const mockButton = {
      getBoundingClientRect: () =>
        ({
          left: 100,
          top: 200,
          width: 80,
          height: 30,
          right: 180,
          bottom: 230,
        }) as DOMRect,
    } as HTMLButtonElement;

    act(() => {
      result.current.openPopover('slot-key-1', mockButton);
    });

    expect(result.current.activePopoverKey).toBe('slot-key-1');
    expect(result.current.activeRect).toBeDefined();
    expect(result.current.activeCursor).toBeNull();
  });

  it('openPopover sets activeCursor when clientX/Y provided', () => {
    const { result } = renderHook(() => usePopoverManager());

    const mockButton = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 50, height: 20 }) as DOMRect,
    } as HTMLButtonElement;

    act(() => {
      result.current.openPopover('key-1', mockButton, null, 150, 300);
    });

    expect(result.current.activeCursor).toEqual({ x: 150, y: 300 });
  });

  it('openPopover does nothing when draggedId is set', () => {
    const { result } = renderHook(() => usePopoverManager());

    const mockButton = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 50, height: 20 }) as DOMRect,
    } as HTMLButtonElement;

    act(() => {
      result.current.openPopover('key-1', mockButton, 'dragged-id');
    });

    expect(result.current.activePopoverKey).toBeNull();
  });

  it('setActivePopoverKey can set key directly', () => {
    const { result } = renderHook(() => usePopoverManager());

    act(() => {
      result.current.setActivePopoverKey('direct-key');
    });

    expect(result.current.activePopoverKey).toBe('direct-key');
  });

  it('setActivePopoverKey can clear key', () => {
    const { result } = renderHook(() => usePopoverManager());

    act(() => {
      result.current.setActivePopoverKey('key-1');
    });
    act(() => {
      result.current.setActivePopoverKey(null);
    });

    expect(result.current.activePopoverKey).toBeNull();
  });

  it('getPopoverStyle returns defaults when no activeRect', () => {
    const { result } = renderHook(() => usePopoverManager());
    const style = result.current.getPopoverStyle(200, 300);
    expect(style).toEqual({ top: 0, left: 0, width: 200 });
  });

  it('getPopoverStyle computes position based on activeRect', () => {
    const { result } = renderHook(() => usePopoverManager());

    const mockButton = {
      getBoundingClientRect: () =>
        ({
          left: 100,
          top: 200,
          width: 80,
          height: 30,
          right: 180,
          bottom: 230,
        }) as DOMRect,
    } as HTMLButtonElement;

    act(() => {
      result.current.openPopover('key-1', mockButton);
    });

    const style = result.current.getPopoverStyle(200, 100);
    expect(typeof style.top).toBe('number');
    expect(typeof style.left).toBe('number');
    expect(style.width).toBe(200);
  });

  it('schedulePopoverClose closes popover after timeout', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => usePopoverManager());

    act(() => {
      result.current.setActivePopoverKey('key-1');
    });

    act(() => {
      result.current.schedulePopoverClose();
    });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(result.current.activePopoverKey).toBeNull();
    jest.useRealTimers();
  });

  it('clearCloseTimer cancels the scheduled close', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => usePopoverManager());

    act(() => {
      result.current.setActivePopoverKey('key-1');
      result.current.schedulePopoverClose();
      result.current.clearCloseTimer();
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    // After clearing, popover should still be open
    expect(result.current.activePopoverKey).toBe('key-1');
    jest.useRealTimers();
  });
});
