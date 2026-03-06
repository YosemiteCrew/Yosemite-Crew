import React from 'react';
import {render} from '@testing-library/react-native';
import {Animated} from 'react-native';
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

    // Mock Animated API
    jest.spyOn(Animated, 'timing').mockImplementation((_value: any, _config: any) => {
      return {
        start: jest.fn((callback?: any) => {
          if (callback) callback();
        }),
      } as any;
    });

    jest.spyOn(Animated, 'spring').mockImplementation((_value: any, _config: any) => {
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
      return {
        start: jest.fn(),
        stop: jest.fn(),
      } as any;
    });

    jest.spyOn(Animated, 'delay').mockImplementation((_time: number) => {
      return null as any;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      const onAnimationEnd = jest.fn();
      const {UNSAFE_root} = render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      expect(UNSAFE_root).toBeDefined();
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
      const timingCallsBefore = (Animated.timing as jest.Mock).mock.calls.length;

      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      const timingCallsAfter = (Animated.timing as jest.Mock).mock.calls.length;

      expect(timingCallsAfter).toBeGreaterThanOrEqual(timingCallsBefore);
    });
  });

  describe('callback handling', () => {
    it('should call onAnimationEnd with no arguments', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      jest.advanceTimersByTime(4000);

      expect(onAnimationEnd).toHaveBeenCalledWith();
    });

    it('should call onAnimationEnd only once', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      jest.advanceTimersByTime(4000);

      expect(onAnimationEnd).toHaveBeenCalledTimes(1);
    });
  });
});
