import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { useOnClickOutside } from '@/app/hooks/useOnClickOutside';

describe('useOnClickOutside', () => {
  const addEventListenerMock = jest.spyOn(document, 'addEventListener');
  const removeEventListenerMock = jest.spyOn(document, 'removeEventListener');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers and removes mouse and touch listeners when enabled', () => {
    const { result, unmount } = renderHook(() => {
      const ref = useRef<HTMLElement | null>(document.createElement('div'));
      const handler = jest.fn();

      useOnClickOutside(ref, handler);

      return { ref, handler };
    });

    expect(addEventListenerMock).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(addEventListenerMock).toHaveBeenCalledWith('touchstart', expect.any(Function));

    unmount();

    expect(removeEventListenerMock).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(removeEventListenerMock).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(result.current.handler).toHaveBeenCalledTimes(0);
  });

  it('does not register listeners when disabled', () => {
    renderHook(() => {
      const ref = useRef<HTMLElement | null>(document.createElement('div'));
      const handler = jest.fn();

      useOnClickOutside(ref, handler, false);
    });

    expect(addEventListenerMock).not.toHaveBeenCalled();
    expect(removeEventListenerMock).not.toHaveBeenCalled();
  });

  it('calls the handler for outside pointer events and ignores inside events', () => {
    const outsideTarget = document.createElement('button');
    const insideTarget = document.createElement('span');
    const handler = jest.fn();

    renderHook(() => {
      const ref = useRef<HTMLElement | null>(document.createElement('div'));
      ref.current?.appendChild(insideTarget);

      useOnClickOutside(ref, handler);

      return ref;
    });

    const mousedownListener = addEventListenerMock.mock.calls.find(
      ([type]) => type === 'mousedown'
    )?.[1] as EventListener;
    const touchstartListener = addEventListenerMock.mock.calls.find(
      ([type]) => type === 'touchstart'
    )?.[1] as EventListener;

    act(() => {
      mousedownListener?.({ target: outsideTarget } as unknown as MouseEvent);
      touchstartListener?.({ target: insideTarget } as unknown as TouchEvent);
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
