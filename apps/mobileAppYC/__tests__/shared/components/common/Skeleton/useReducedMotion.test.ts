import {renderHook, act, waitFor} from '@testing-library/react-native';
import {AccessibilityInfo} from 'react-native';
import {useReducedMotion} from '@/shared/components/common/Skeleton/useReducedMotion';

type ReduceMotionListener = (value: boolean) => void;

describe('useReducedMotion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns false initially before the OS value resolves', () => {
    // A promise that never settles keeps the hook on its initial state.
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(new Promise<boolean>(() => {}) as any);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({remove: jest.fn()} as any);

    const {result} = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });

  it('reflects the OS reduce-motion value once the promise resolves (enabled)', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true as any);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({remove: jest.fn()} as any);

    const {result} = renderHook(() => useReducedMotion());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('subscribes to reduceMotionChanged and updates when the event fires', async () => {
    let listener: ReduceMotionListener | undefined;
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false as any);
    const addListenerSpy = jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockImplementation((event: string, cb: ReduceMotionListener) => {
        listener = cb;
        return {remove: jest.fn()} as any;
      });

    const {result} = renderHook(() => useReducedMotion());

    // Let the initial isReduceMotionEnabled promise settle to false.
    await waitFor(() => expect(result.current).toBe(false));
    expect(addListenerSpy).toHaveBeenCalledWith(
      'reduceMotionChanged',
      expect.any(Function),
    );

    act(() => {
      listener?.(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      listener?.(false);
    });
    expect(result.current).toBe(false);
  });

  it('does not update state when the promise resolves after unmount', async () => {
    let resolvePromise: (value: boolean) => void = () => {};
    const pending = new Promise<boolean>(resolve => {
      resolvePromise = resolve;
    });
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(pending as any);
    const removeSpy = jest.fn();
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({remove: removeSpy} as any);

    const {result, unmount} = renderHook(() => useReducedMotion());
    unmount();

    // Subscription is torn down on unmount.
    expect(removeSpy).toHaveBeenCalledTimes(1);

    // Resolving now hits the `mounted === false` guard, so no state update.
    await act(async () => {
      resolvePromise(true);
      await pending;
    });
    expect(result.current).toBe(false);
  });

  it('unmounts cleanly when addEventListener returns no subscription', () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false as any);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue(undefined as any);

    const {unmount} = renderHook(() => useReducedMotion());

    expect(() => unmount()).not.toThrow();
  });

  it('unmounts cleanly when the subscription has no remove method', () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false as any);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({} as any);

    const {unmount} = renderHook(() => useReducedMotion());

    expect(() => unmount()).not.toThrow();
  });
});
