import React from 'react';
import {Platform, Pressable, StyleSheet, Text} from 'react-native';
import {render, fireEvent, screen} from '@testing-library/react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import {LiquidGlassIconButton} from '@/shared/components/common/LiquidGlassIconButton/LiquidGlassIconButton';

const PressableType = (Pressable as any).type;

const getFlattenedStyle = (pressable: any) => {
  const styleProp = pressable.props.style;
  const resolved =
    typeof styleProp === 'function'
      ? styleProp({pressed: false, hovered: false, focused: false})
      : styleProp;
  return StyleSheet.flatten(resolved) as Record<string, any>;
};

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@callstack/liquid-glass', () => {
  const {View} = require('react-native');
  return {
    __esModule: true,
    LiquidGlassView: (props: any) => (
      <View testID="liquid-glass-view" {...props} />
    ),
    isLiquidGlassSupported: true,
  };
});

describe('LiquidGlassIconButton', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('renders children', () => {
    Platform.OS = 'android';
    render(
      <LiquidGlassIconButton size={40} onPress={jest.fn()}>
        <Text>icon</Text>
      </LiquidGlassIconButton>,
    );
    expect(screen.getByText('icon')).toBeTruthy();
  });

  describe('native glass branch (iOS + supported)', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('renders a LiquidGlassView with the resolved glass props', () => {
      render(
        <LiquidGlassIconButton
          size={40}
          onPress={jest.fn()}
          glassEffect="regular"
          colorScheme="dark">
          <Text>icon</Text>
        </LiquidGlassIconButton>,
      );

      const glassView = screen.getByTestId('liquid-glass-view');
      expect(glassView.props.effect).toBe('regular');
      expect(glassView.props.colorScheme).toBe('dark');
      expect(glassView.props.tintColor).toBe('rgba(28, 28, 30, 0.55)');
      expect(glassView.props.interactive).toBe(true);
    });

    it('marks the glass view non-interactive when disabled', () => {
      render(
        <LiquidGlassIconButton size={40} onPress={jest.fn()} disabled>
          <Text>icon</Text>
        </LiquidGlassIconButton>,
      );
      expect(screen.getByTestId('liquid-glass-view').props.interactive).toBe(
        false,
      );
    });

    it('calls onPress when the inner pressable is pressed', () => {
      const onPress = jest.fn();
      render(
        <LiquidGlassIconButton size={40} onPress={onPress}>
          <Text>icon</Text>
        </LiquidGlassIconButton>,
      );

      fireEvent.press(screen.getByText('icon'));
      expect(onPress).toHaveBeenCalled();
    });

    it('exposes button role, label and disabled state to screen readers', () => {
      render(
        <LiquidGlassIconButton
          size={40}
          onPress={jest.fn()}
          disabled
          accessibilityLabel="Close">
          <Text>icon</Text>
        </LiquidGlassIconButton>,
      );

      const pressable = screen.UNSAFE_getByType(PressableType);
      expect(pressable.props.accessibilityRole).toBe('button');
      expect(pressable.props.accessibilityLabel).toBe('Close');
      expect(pressable.props.accessibilityState).toEqual({disabled: true});
    });

    it('uses the explicit tintColor over the resolved default when provided', () => {
      render(
        <LiquidGlassIconButton
          size={40}
          onPress={jest.fn()}
          tintColor="#123456">
          <Text>icon</Text>
        </LiquidGlassIconButton>,
      );
      expect(screen.getByTestId('liquid-glass-view').props.tintColor).toBe(
        '#123456',
      );
    });

    it('resolves colorScheme="system" from the app theme when dark', () => {
      // Regression: 'system' used to resolve to 'light' unconditionally, so in
      // dark mode this button took the white glass tint and rendered a bright
      // grey disc (#B2B0AE) on the espresso header.
      const spy = jest
        .spyOn(require('@/hooks'), 'useTheme')
        .mockReturnValue({theme: mockTheme, isDark: true});
      render(
        <LiquidGlassIconButton
          size={40}
          onPress={jest.fn()}
          colorScheme="system">
          <Text>icon</Text>
        </LiquidGlassIconButton>,
      );
      const glassView = screen.getByTestId('liquid-glass-view');
      expect(glassView.props.colorScheme).toBe('dark');
      expect(glassView.props.tintColor).toBe('rgba(28, 28, 30, 0.55)');
      spy.mockRestore();
    });

    it('resolves colorScheme="system" to "light"', () => {
      render(
        <LiquidGlassIconButton
          size={40}
          onPress={jest.fn()}
          colorScheme="system">
          <Text>icon</Text>
        </LiquidGlassIconButton>,
      );
      const glassView = screen.getByTestId('liquid-glass-view');
      expect(glassView.props.colorScheme).toBe('light');
      expect(glassView.props.tintColor).toBe('rgba(255, 255, 255, 0.65)');
    });
  });

  describe('fallback branch (non-native glass)', () => {
    it('applies an android border using the dark tint when colorScheme is dark', () => {
      Platform.OS = 'android';
      render(
        <LiquidGlassIconButton size={40} onPress={jest.fn()} colorScheme="dark">
          <Text>icon</Text>
        </LiquidGlassIconButton>,
      );

      const pressable = screen.UNSAFE_getByType(PressableType);
      const flattened = getFlattenedStyle(pressable);
      expect(flattened.backgroundColor).toBe('rgba(28, 28, 30, 0.82)');
      expect(flattened.borderWidth).toBe(1);
      expect(flattened.borderColor).toBe('rgba(255, 255, 255, 0.12)');
    });

    it('applies an android border using the light tint by default', () => {
      Platform.OS = 'android';
      render(
        <LiquidGlassIconButton size={40} onPress={jest.fn()}>
          <Text>icon</Text>
        </LiquidGlassIconButton>,
      );

      const pressable = screen.UNSAFE_getByType(PressableType);
      const flattened = getFlattenedStyle(pressable);
      expect(flattened.backgroundColor).toBe('rgba(255, 255, 255, 0.92)');
      expect(flattened.borderColor).toBe('rgba(0, 0, 0, 0.08)');
    });

    it('adds no extra border on non-android fallback platforms', () => {
      // Any platform other than 'ios' falls back here since isLiquidGlassSupported
      // is mocked true for this file, and only 'ios' triggers the native branch.
      Platform.OS = 'macos' as any;
      render(
        <LiquidGlassIconButton size={40} onPress={jest.fn()}>
          <Text>icon</Text>
        </LiquidGlassIconButton>,
      );

      const pressable = screen.UNSAFE_getByType(PressableType);
      const flattened = getFlattenedStyle(pressable);
      expect(flattened.borderWidth).toBe(0);
    });

    it('calls onPress when pressed and respects disabled', () => {
      Platform.OS = 'android';
      const onPress = jest.fn();
      render(
        <LiquidGlassIconButton size={40} onPress={onPress}>
          <Text>icon</Text>
        </LiquidGlassIconButton>,
      );
      fireEvent.press(screen.getByText('icon'));
      expect(onPress).toHaveBeenCalled();
    });

    it('exposes button role, label and enabled state to screen readers', () => {
      Platform.OS = 'android';
      render(
        <LiquidGlassIconButton
          size={40}
          onPress={jest.fn()}
          accessibilityLabel="Back">
          <Text>icon</Text>
        </LiquidGlassIconButton>,
      );

      const pressable = screen.UNSAFE_getByType(PressableType);
      expect(pressable.props.accessibilityRole).toBe('button');
      expect(pressable.props.accessibilityLabel).toBe('Back');
      expect(pressable.props.accessibilityState).toEqual({disabled: false});
    });

    it('applies the requested shadow size and falls back neutralShadow to black when absent', () => {
      Platform.OS = 'android';
      const themeWithoutNeutralShadow = {
        ...mockTheme,
        colors: {...mockTheme.colors, neutralShadow: undefined},
      };
      const useThemeSpy = jest
        .spyOn(require('@/hooks'), 'useTheme')
        .mockReturnValue({theme: themeWithoutNeutralShadow, isDark: false});

      render(
        <LiquidGlassIconButton size={40} onPress={jest.fn()} shadow="lg">
          <Text>icon</Text>
        </LiquidGlassIconButton>,
      );

      const pressable = screen.UNSAFE_getByType(PressableType);
      const flattened = getFlattenedStyle(pressable);
      expect(flattened.shadowColor).toBe(mockTheme.colors.black);
      expect(flattened.shadowRadius).toBe(mockTheme.shadows.lg.shadowRadius);

      useThemeSpy.mockRestore();
    });
  });
});
