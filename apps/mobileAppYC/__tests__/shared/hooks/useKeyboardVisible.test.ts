import {renderHook, act} from '@testing-library/react-native';
import {Keyboard} from 'react-native';
import {useKeyboardVisible} from '@/shared/hooks/useKeyboardVisible';

describe('useKeyboardVisible', () => {
  it('starts as false', () => {
    const {result} = renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(false);
  });

  it('becomes true when the keyboard shows and false again when it hides', () => {
    let showCallback: (() => void) | undefined;
    let hideCallback: (() => void) | undefined;
    const addListenerSpy = jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((event: string, cb: () => void) => {
        if (event === 'keyboardDidShow') {
          showCallback = cb;
        } else {
          hideCallback = cb;
        }
        return {remove: jest.fn()} as any;
      });

    const {result} = renderHook(() => useKeyboardVisible());

    act(() => {
      showCallback?.();
    });
    expect(result.current).toBe(true);

    act(() => {
      hideCallback?.();
    });
    expect(result.current).toBe(false);

    addListenerSpy.mockRestore();
  });

  it('removes its listeners on unmount', () => {
    const removeShow = jest.fn();
    const removeHide = jest.fn();
    const addListenerSpy = jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementationOnce(() => ({remove: removeShow}) as any)
      .mockImplementationOnce(() => ({remove: removeHide}) as any);

    const {unmount} = renderHook(() => useKeyboardVisible());
    unmount();

    expect(removeShow).toHaveBeenCalledTimes(1);
    expect(removeHide).toHaveBeenCalledTimes(1);

    addListenerSpy.mockRestore();
  });
});
