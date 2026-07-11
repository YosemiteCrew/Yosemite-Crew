import React from 'react';
import {Animated, StyleSheet} from 'react-native';
import {act, render} from '@testing-library/react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import {SkeletonBlock} from '@/shared/components/common/Skeleton/SkeletonBlock';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// Static tint / pulse constants mirrored from the source.
const PULSE_STATIC = 0.75;
const PULSE_MAX = 1;

// Flatten the root Animated.View style into a plain object for assertions.
const rootStyleOf = (tree: any) => StyleSheet.flatten(tree?.props?.style) ?? {};

describe('SkeletonBlock', () => {
  let startMock: jest.Mock;
  let stopMock: jest.Mock;
  let loopSpy: jest.SpyInstance;
  let setValueSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    startMock = jest.fn();
    stopMock = jest.fn();
    // Replace the pulse loop with an inspectable handle so we can assert
    // start/stop without running a real native-driver animation.
    loopSpy = jest
      .spyOn(Animated, 'loop')
      .mockReturnValue({start: startMock, stop: stopMock} as never);
    setValueSpy = jest.spyOn(Animated.Value.prototype, 'setValue');
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders a fill using default width/height/radius and the theme inset tint', () => {
    const {toJSON} = render(<SkeletonBlock />);

    const style = rootStyleOf(toJSON());
    expect(style.width).toBe('100%');
    expect(style.height).toBe(12);
    expect(style.borderRadius).toBe(8);
    expect(style.backgroundColor).toBe(mockTheme.colors.inset);
  });

  it('applies custom width, height, radius and merges the passed style', () => {
    const {toJSON} = render(
      <SkeletonBlock
        width={200}
        height={40}
        radius={4}
        style={{marginTop: 6}}
      />,
    );

    const style = rootStyleOf(toJSON());
    expect(style.width).toBe(200);
    expect(style.height).toBe(40);
    expect(style.borderRadius).toBe(4);
    expect(style.marginTop).toBe(6);
  });

  it('shows a static tint and skips the pulse loop when reduceMotion is true', () => {
    render(<SkeletonBlock reduceMotion />);

    // Early-return branch: no animation loop is ever constructed.
    expect(loopSpy).not.toHaveBeenCalled();
    expect(setValueSpy).toHaveBeenCalledWith(PULSE_STATIC);

    // Even after time passes nothing starts pulsing.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(startMock).not.toHaveBeenCalled();
  });

  it('builds the pulse loop and starts it only after the delay elapses', () => {
    render(<SkeletonBlock delay={200} />);

    // Loop is constructed at mount and the opacity is reset to the max.
    expect(loopSpy).toHaveBeenCalledTimes(1);
    expect(setValueSpy).toHaveBeenCalledWith(PULSE_MAX);
    expect(startMock).not.toHaveBeenCalled();

    // Nothing starts before the stagger delay.
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(startMock).not.toHaveBeenCalled();

    // Once the full delay passes the loop starts exactly once.
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it('starts the pulse loop promptly with the default zero delay', () => {
    render(<SkeletonBlock />);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it('clears the pending timer and stops the loop on unmount', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const {unmount} = render(<SkeletonBlock delay={50} />);

    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(startMock).toHaveBeenCalledTimes(1);

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(stopMock).toHaveBeenCalledTimes(1);
  });
});
