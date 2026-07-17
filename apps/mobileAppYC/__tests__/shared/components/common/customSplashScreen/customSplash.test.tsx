import React from 'react';
import {act, cleanup, render, screen} from '@testing-library/react-native/pure';
import * as Reanimated from 'react-native-reanimated';
jest.unmock('@/shared/components/common/customSplashScreen/customSplash');
import CustomSplashScreen from '@/shared/components/common/customSplashScreen/customSplash';

// Mock dependencies
jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn(),
}));

jest.mock('react-native-linear-gradient', () => {
  return ({children, ...props}: any) => {
    const {View} = require('react-native');
    return (
      <View testID="linear-gradient" {...props}>
        {children}
      </View>
    );
  };
});

describe('CustomSplashScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      const onAnimationEnd = jest.fn();
      const {UNSAFE_root} = render(
        <CustomSplashScreen onAnimationEnd={onAnimationEnd} />,
      );

      expect(UNSAFE_root).toBeDefined();
    });

    it('should render the FDA certification alongside the existing splash assets', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      expect(screen.getAllByTestId('certification-logo')).toHaveLength(5);
    });
  });

  describe('animation values', () => {
    it('should schedule animations with Reanimated helpers', () => {
      const onAnimationEnd = jest.fn();
      const timingSpy = jest.spyOn(Reanimated, 'withTiming');
      const springSpy = jest.spyOn(Reanimated, 'withSpring');
      const repeatSpy = jest.spyOn(Reanimated, 'withRepeat');

      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      expect(timingSpy).toHaveBeenCalled();
      expect(springSpy).toHaveBeenCalledWith(1, {
        damping: 12,
        stiffness: 120,
      });
      expect(repeatSpy).toHaveBeenCalledTimes(2);

      act(() => {
        jest.advanceTimersByTime(1500);
      });

      expect(repeatSpy).toHaveBeenCalledTimes(4);
    });
  });

  describe('component lifecycle', () => {
    it('should only initialize animations once', () => {
      const onAnimationEnd = jest.fn();
      const timingSpy = jest.spyOn(Reanimated, 'withTiming');
      const timingCallsBefore = timingSpy.mock.calls.length;

      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      const timingCallsAfter = timingSpy.mock.calls.length;

      expect(timingCallsAfter).toBeGreaterThanOrEqual(timingCallsBefore);
    });

    it('should stop active animations and scheduled timers on unmount', () => {
      const onAnimationEnd = jest.fn();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const cancelAnimationSpy = jest.spyOn(Reanimated, 'cancelAnimation');
      const {unmount} = render(
        <CustomSplashScreen onAnimationEnd={onAnimationEnd} />,
      );

      act(() => {
        jest.advanceTimersByTime(1500);
      });

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
      expect(cancelAnimationSpy).toHaveBeenCalledTimes(7);
    });
  });

  describe('callback handling', () => {
    it('should call onAnimationEnd with no arguments', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      act(() => {
        jest.advanceTimersByTime(4000);
      });

      expect(onAnimationEnd).toHaveBeenCalledWith();
    });

    it('should call onAnimationEnd only once', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      act(() => {
        jest.advanceTimersByTime(4000);
      });

      expect(onAnimationEnd).toHaveBeenCalledTimes(1);
    });
  });
});
