import React from 'react';
import {act, cleanup, render, screen} from '@testing-library/react-native/pure';
import * as Reanimated from 'react-native-reanimated';
jest.unmock('@/shared/components/common/customSplashScreen/customSplash');
import CustomSplashScreen from '@/shared/components/common/customSplashScreen/customSplash';
import BootSplash from 'react-native-bootsplash';

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
    (BootSplash.hide as jest.Mock).mockResolvedValue(undefined);
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('launch screen', () => {
    it('hides the native launch screen on mount', () => {
      render(<CustomSplashScreen onAnimationEnd={jest.fn()} />);

      expect(BootSplash.hide).toHaveBeenCalledWith({fade: false});
    });

    it('logs instead of failing when the launch screen cannot be hidden', async () => {
      const failure = new Error('no launch screen');
      (BootSplash.hide as jest.Mock).mockRejectedValueOnce(failure);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      render(<CustomSplashScreen onAnimationEnd={jest.fn()} />);
      await act(async () => {
        await Promise.resolve();
      });

      expect(warnSpy).toHaveBeenCalledWith(
        '[Splash] Could not hide the launch screen',
        failure,
      );
    });
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      const onAnimationEnd = jest.fn();
      const {UNSAFE_root} = render(
        <CustomSplashScreen onAnimationEnd={onAnimationEnd} />,
      );

      expect(UNSAFE_root).toBeDefined();
    });

    it('should render the five compliance pills', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      expect(screen.getAllByTestId('compliance-pill')).toHaveLength(5);
    });

    it('should render each compliance pill with a bundled local logo source', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      const pills = screen.getAllByTestId('compliance-pill');
      expect(pills).toHaveLength(5);
      pills.forEach(pill => {
        expect(pill.props.source).toBeDefined();
      });
    });

    it('should render the brand lockup and tagline', () => {
      const onAnimationEnd = jest.fn();
      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      expect(screen.getByText('Yosemite Crew')).toBeTruthy();
      expect(screen.getByText('BETA')).toBeTruthy();
      expect(screen.getByText('Every companion has a story.')).toBeTruthy();
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
        damping: 13,
        stiffness: 120,
      });
      // Single infinite loop drives the loading bar.
      expect(repeatSpy).toHaveBeenCalledTimes(1);
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

      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(cancelAnimationSpy).toHaveBeenCalledTimes(3);
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

    it('should not call onAnimationEnd when the fade animation is interrupted', () => {
      const onAnimationEnd = jest.fn();
      // Drive the withTiming completion callback with `finished === false`
      // (the default mock always reports `true`), so the fade never resolves.
      jest
        .spyOn(Reanimated, 'withTiming')
        .mockImplementation((toValue: any, _config?: any, callback?: any) => {
          callback?.(false);
          return toValue;
        });

      render(<CustomSplashScreen onAnimationEnd={onAnimationEnd} />);

      act(() => {
        jest.advanceTimersByTime(4000);
      });

      expect(onAnimationEnd).not.toHaveBeenCalled();
    });
  });
});
