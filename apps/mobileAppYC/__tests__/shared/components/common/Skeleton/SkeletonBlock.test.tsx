import React from 'react';
import {StyleSheet} from 'react-native';
import {render} from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import {mockTheme} from '../../../../setup/mockTheme';
import {SkeletonBlock} from '@/shared/components/common/Skeleton/SkeletonBlock';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// react-native-reanimated is globally mocked in jest.setup.js (useSharedValue ->
// {value}, useAnimatedStyle runs the updater, withTiming/withDelay/withSequence/
// withRepeat pass through). We spy on that shared namespace to assert the pulse
// wiring without running a real UI-thread animation.

// Static tint / pulse constants mirrored from the source.
const PULSE_STATIC = 0.75;
const PULSE_MAX = 1;

// Flatten the root Animated.View style into a plain object for assertions.
const rootStyleOf = (tree: any) => StyleSheet.flatten(tree?.props?.style) ?? {};

describe('SkeletonBlock', () => {
  afterEach(() => {
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
    const repeatSpy = jest.spyOn(Reanimated, 'withRepeat');
    const cancelSpy = jest.spyOn(Reanimated, 'cancelAnimation');

    const {toJSON} = render(<SkeletonBlock reduceMotion />);

    // Early-return branch: no pulse animation is ever constructed, the driver
    // is cancelled and held at the static tint.
    expect(repeatSpy).not.toHaveBeenCalled();
    expect(cancelSpy).toHaveBeenCalled();
    expect(rootStyleOf(toJSON()).opacity).toBe(PULSE_STATIC);
  });

  it('builds the staggered pulse loop when reduceMotion is off', () => {
    const repeatSpy = jest.spyOn(Reanimated, 'withRepeat');
    const sequenceSpy = jest.spyOn(Reanimated, 'withSequence');
    const delaySpy = jest.spyOn(Reanimated, 'withDelay');

    const {toJSON} = render(<SkeletonBlock delay={200} />);

    // A repeating (-1) sequence is scheduled behind the per-block stagger delay.
    expect(sequenceSpy).toHaveBeenCalledTimes(1);
    expect(repeatSpy).toHaveBeenCalledWith(expect.anything(), -1);
    expect(delaySpy).toHaveBeenCalledWith(200, expect.anything());
    // The driver starts from the max-opacity end of the pulse.
    expect(rootStyleOf(toJSON()).opacity).toBe(PULSE_MAX);
  });

  it('cancels the running pulse on unmount', () => {
    const cancelSpy = jest.spyOn(Reanimated, 'cancelAnimation');
    const {unmount} = render(<SkeletonBlock />);

    cancelSpy.mockClear();
    unmount();

    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });
});
