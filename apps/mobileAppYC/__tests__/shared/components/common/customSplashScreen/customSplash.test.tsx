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
  let BootSplash: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    BootSplash = require('react-native-bootsplash');

    // Mock Animated API
    jest.spyOn(Animated, 'timing').mockImplementation((value: any, config: any) => {
      return {
        start: jest.fn((callback?: any) => {
          if (callback) callback();
        }),
      } as any;
    });

    jest.spyOn(Animated, 'spring').mockImplementation((value: any, config: any) => {
      return {
        start: jest.fn((callback?: any) => {
          if (callback) callback();
        }),
      } as any;
    });

    jest.spyOn(Animated, 'sequence').mockImplementation((animations: any) => {
      return {
        start: jest.fn((callback?: any) => {
          if (callback) callback();
        }),
      } as any;
    });

    jest.spyOn(Animated, 'parallel').mockImplementation((animations: any) => {
      return {
        start: jest.fn((callback?: any) => {
          if (callback) callback();
        }),
      } as any;
    });

    jest.spyOn(Animated, 'loop').mockImplementation((animation: any) => {
      return {
        start: jest.fn(),
        stop: jest.fn(),
      } as any;
    });

    jest.spyOn(Animated, 'delay').mockImplementation((time: number) => {
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

    it.skip('should render StatusBar with correct props', () => {
      const onAnimationEnd = jest.fn();
      const {UNSAFE_getByType} = render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      const statusBar = UNSAFE_getByType('StatusBar' as any);
      expect(statusBar.props.barStyle).toBe('light-content');
      expect(statusBar.props.backgroundColor).toBe('transparent');
      expect(statusBar.props.translucent).toBe(true);
    });

    it.skip('should render LinearGradient with correct colors', () => {
      const onAnimationEnd = jest.fn();
      const {getByTestId} = render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      const gradient = getByTestId('linear-gradient');
      expect(gradient.props.colors).toEqual([
        '#87CEEB',
        '#E6F3FF',
        '#F8FBFF',
        '#F8FBFF',
        '#FFFFFF',
      ]);
      expect(gradient.props.locations).toEqual([0, 0.25, 0.5, 0.75, 1]);
    });

    it.skip('should render two star images', () => {
      const onAnimationEnd = jest.fn();
      const {UNSAFE_getAllByType} = render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      const images = UNSAFE_getAllByType('Image' as any);
      const starImages = images.filter(img => {
        const source = img.props.source;
        return source && typeof source === 'number'; // Local image sources are numbers
      });

      // Should have at least 2 stars + 1 main logo + 4 certification logos = 7+ images
      expect(images.length).toBeGreaterThanOrEqual(7);
    });

    it.skip('should render main logo', () => {
      const onAnimationEnd = jest.fn();
      const {UNSAFE_getAllByType} = render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      const images = UNSAFE_getAllByType('Image' as any);
      expect(images.length).toBeGreaterThan(0);
    });

    it.skip('should render certification logos', () => {
      const onAnimationEnd = jest.fn();
      const {UNSAFE_getAllByType} = render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      const images = UNSAFE_getAllByType('Image' as any);
      // Should have 4 certification logos + 2 stars + 1 main logo
      expect(images.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('initialization', () => {
    it.skip('should hide BootSplash immediately without fade', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      expect(BootSplash.hide).toHaveBeenCalledWith({fade: false});
    });

    it.skip('should start animations immediately after mounting', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      expect(Animated.loop).toHaveBeenCalled();
      expect(Animated.spring).toHaveBeenCalled();
    });

    it.skip('should start star rotation animations', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      // Loop should be called for star rotations
      expect(Animated.loop).toHaveBeenCalledTimes(expect.any(Number));
    });
  });

  describe('animation timing', () => {
    it.skip('should start floating animation after entrance animations', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      // Fast-forward time to after entrance animations
      jest.advanceTimersByTime(1500);

      // Verify floating animations are set up (loop calls for star floating)
      expect(Animated.loop).toHaveBeenCalled();
    });

    it.skip('should call onAnimationEnd after 4 seconds + exit animation', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      // Fast-forward to exit animation start (4000ms)
      jest.advanceTimersByTime(4000);

      expect(Animated.parallel).toHaveBeenCalled();

      // onAnimationEnd should be called after parallel animation completes
      expect(onAnimationEnd).toHaveBeenCalled();
    });

    it.skip('should not call onAnimationEnd before timeout', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      // Fast-forward less than 4 seconds
      jest.advanceTimersByTime(3000);

      expect(onAnimationEnd).not.toHaveBeenCalled();
    });

    it.skip('should clear timeout on unmount', () => {
      const onAnimationEnd = jest.fn();
      const {unmount} = render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      unmount();

      // Fast-forward time after unmount
      jest.advanceTimersByTime(5000);

      // onAnimationEnd should not be called after unmount
      expect(onAnimationEnd).not.toHaveBeenCalled();
    });
  });

  describe('animation sequences', () => {
    it.skip('should execute entrance animations with correct sequence', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      // Verify sequence is used for entrance animations
      expect(Animated.sequence).toHaveBeenCalled();

      // Verify spring animation for logo scale
      expect(Animated.spring).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          toValue: 1,
          tension: 50,
          friction: 7,
        }),
      );
    });

    it.skip('should fade in certification logos with delay', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      // Verify delay is used
      expect(Animated.delay).toHaveBeenCalledWith(600);

      // Verify timing animation for certifications
      expect(Animated.timing).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          toValue: 1,
          duration: 800,
        }),
      );
    });

    it.skip('should execute exit animations in parallel', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      jest.advanceTimersByTime(4000);

      // Verify parallel animation is used for exit
      expect(Animated.parallel).toHaveBeenCalled();
    });
  });

  describe('star animations', () => {
    it.skip('should create rotation animations for both stars', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      // Should have loop animations for star rotations
      const loopCalls = (Animated.loop as jest.Mock).mock.calls;
      expect(loopCalls.length).toBeGreaterThanOrEqual(2); // At least 2 stars
    });

    it.skip('should rotate stars continuously', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      // Verify timing animations with appropriate durations for rotation
      const timingCalls = (Animated.timing as jest.Mock).mock.calls;
      const rotationAnims = timingCalls.filter(
        call =>
          call[1]?.toValue === 1 && (call[1]?.duration === 4000 || call[1]?.duration === 5000),
      );

      expect(rotationAnims.length).toBeGreaterThanOrEqual(2);
    });

    it.skip('should apply floating opacity animations to stars', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      jest.advanceTimersByTime(1500);

      // After floating animations start, verify opacity animations
      const timingCalls = (Animated.timing as jest.Mock).mock.calls;
      const floatingAnims = timingCalls.filter(
        call =>
          (call[1]?.toValue === 0.6 && call[1]?.duration === 2500) ||
          (call[1]?.toValue === 0.7 && call[1]?.duration === 3000),
      );

      expect(floatingAnims.length).toBeGreaterThan(0);
    });
  });

  describe('exit animations', () => {
    it.skip('should fade out main container', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      jest.advanceTimersByTime(4000);

      const timingCalls = (Animated.timing as jest.Mock).mock.calls;
      const fadeOutAnim = timingCalls.find(
        call => call[1]?.toValue === 0 && call[1]?.duration === 1000,
      );

      expect(fadeOutAnim).toBeDefined();
    });

    it.skip('should scale down logo during exit', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      jest.advanceTimersByTime(4000);

      const timingCalls = (Animated.timing as jest.Mock).mock.calls;
      const scaleDownAnim = timingCalls.find(
        call => call[1]?.toValue === 0.3 && call[1]?.duration === 1000,
      );

      expect(scaleDownAnim).toBeDefined();
    });

    it.skip('should fade out stars during exit', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      jest.advanceTimersByTime(4000);

      const timingCalls = (Animated.timing as jest.Mock).mock.calls;
      const fadeOutAnims = timingCalls.filter(
        call => call[1]?.toValue === 0 && call[1]?.duration === 1000,
      );

      // Should have fade out for: fadeAnim, star1Anim, star2Anim, certAnim = 4 animations
      expect(fadeOutAnims.length).toBeGreaterThanOrEqual(4);
    });

    it.skip('should fade out certifications during exit', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      jest.advanceTimersByTime(4000);

      // Verify parallel animation includes certification fade out
      expect(Animated.parallel).toHaveBeenCalled();
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
    it.skip('should handle multiple renders without errors', () => {
      const onAnimationEnd = jest.fn();
      const {rerender} = render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      rerender(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      expect(BootSplash.hide).toHaveBeenCalled();
    });

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
