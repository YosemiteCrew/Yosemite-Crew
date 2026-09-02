import React from 'react';
import {Platform, Text} from 'react-native';
import {render, screen} from '@testing-library/react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';

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

const darkTheme = () =>
  jest
    .spyOn(require('@/hooks'), 'useTheme')
    .mockReturnValue({theme: mockTheme, isDark: true});

describe('LiquidGlassCard', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
    jest.restoreAllMocks();
  });

  it('renders children', () => {
    Platform.OS = 'ios';
    render(
      <LiquidGlassCard>
        <Text>card body</Text>
      </LiquidGlassCard>,
    );
    expect(screen.getByText('card body')).toBeTruthy();
  });

  describe('native glass branch (iOS + supported)', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('follows the app theme by default in dark mode', () => {
      // Regression: the default was 'light' and 'system' resolved to 'light'
      // unconditionally, so every card in the app asked native glass for
      // light-mode vibrancy on espresso - including the Home header, which is
      // a LiquidGlassCard.
      darkTheme();
      render(
        <LiquidGlassCard>
          <Text>card body</Text>
        </LiquidGlassCard>,
      );
      expect(screen.getByTestId('liquid-glass-view').props.colorScheme).toBe(
        'dark',
      );
    });

    it('follows the app theme by default in light mode', () => {
      render(
        <LiquidGlassCard>
          <Text>card body</Text>
        </LiquidGlassCard>,
      );
      expect(screen.getByTestId('liquid-glass-view').props.colorScheme).toBe(
        'light',
      );
    });

    it('still honours an explicit colorScheme over the theme', () => {
      darkTheme();
      render(
        <LiquidGlassCard colorScheme="light">
          <Text>card body</Text>
        </LiquidGlassCard>,
      );
      expect(screen.getByTestId('liquid-glass-view').props.colorScheme).toBe(
        'light',
      );
    });

    it('tints with the themed glass surface', () => {
      render(
        <LiquidGlassCard>
          <Text>card body</Text>
        </LiquidGlassCard>,
      );
      expect(screen.getByTestId('liquid-glass-view').props.tintColor).toBe(
        mockTheme.colors.glassSurface,
      );
    });
  });

  describe('android blur branch', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('blurs dark when the app theme is dark', () => {
      darkTheme();
      render(
        <LiquidGlassCard>
          <Text>card body</Text>
        </LiquidGlassCard>,
      );
      expect(screen.UNSAFE_getByProps({blurAmount: 14}).props.blurType).toBe(
        'dark',
      );
    });

    it('blurs light when the app theme is light', () => {
      render(
        <LiquidGlassCard>
          <Text>card body</Text>
        </LiquidGlassCard>,
      );
      expect(screen.UNSAFE_getByProps({blurAmount: 14}).props.blurType).toBe(
        'light',
      );
    });
  });
});
