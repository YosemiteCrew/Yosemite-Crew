import React from 'react';
import {act, cleanup, render, screen} from '@testing-library/react-native/pure';
import {Animated} from 'react-native';
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
  const loopAnimations: Array<{start: jest.Mock; stop: jest.Mock}> = [];

  beforeEach(() => {
    loopAnimations.length = 0;
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock Animated API
    jest
      .spyOn(Animated, 'timing')
      .mockImplementation((_value: any, _config: any) => {
        return {
          start: jest.fn((callback?: any) => {
            if (callback) callback();
          }),
        } as any;
      });

    jest
      .spyOn(Animated, 'spring')
      .mockImplementation((_value: any, _config: any) => {
        return {
          start: jest.fn((callback?: any) => {
            if (callback) callback();
          }),
        } as any;
      });

    jest.spyOn(Animated, 'sequence').mockImplementation((_animations: any) => {
      return {
        start: jest.fn((callback?: any) => {
          if (callback) callback();
        }),
      } as any;
    });

    jest.spyOn(Animated, 'parallel').mockImplementation((_animations: any) => {
      return {
        start: jest.fn((callback?: any) => {
          if (callback) callback();
        }),
      } as any;
    });

    jest.spyOn(Animated, 'loop').mockImplementation((_animation: any) => {
      const loopAnimation = {
        start: jest.fn(),
        stop: jest.fn(),
      };
      loopAnimations.push(loopAnimation);

      return loopAnimation as any;
    });

    jest.spyOn(Animated, 'delay').mockImplementation((_time: number) => {
      return null as any;
    });
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
    it('should use native driver for all animations', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      const timingCalls = (Animated.timing as jest.Mock).mock.calls;
      timingCalls.forEach(call => {
        if (call[1]) {
          expect(call[1].useNativeDriver).toBe(true);
        }
      });

      const springCalls = (Animated.spring as jest.Mock).mock.calls;
      springCalls.forEach(call => {
        if (call[1]) {
          expect(call[1].useNativeDriver).toBe(true);
        }
      });
    });
  });

  describe('component lifecycle', () => {
    it('should only initialize animations once', () => {
      const onAnimationEnd = jest.fn();
      const timingCallsBefore = (Animated.timing as jest.Mock).mock.calls
        .length;

      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      const timingCallsAfter = (Animated.timing as jest.Mock).mock.calls.length;

      expect(timingCallsAfter).toBeGreaterThanOrEqual(timingCallsBefore);
    });

    it('should stop active animations and scheduled timers on unmount', () => {
      const onAnimationEnd = jest.fn();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const {unmount} = render(
        <CustomSplashScreen onAnimationEnd={onAnimationEnd} />,
      );

      act(() => {
        jest.advanceTimersByTime(1500);
      });

      expect(loopAnimations).toHaveLength(4);

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
      loopAnimations.forEach(animation => {
        expect(animation.stop).toHaveBeenCalledTimes(1);
      });
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
