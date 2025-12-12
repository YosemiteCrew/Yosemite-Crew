import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {YearlySpendCard} from '../../../src/shared/components/common/YearlySpendCard/YearlySpendCard';
import {Image, TouchableOpacity} from 'react-native';

// --- Mocks ---

// Mock Images
jest.mock('@/assets/images', () => ({
  Images: {
    walletIcon: {uri: 'wallet-icon-png'},
    viewIconSlide: {uri: 'view-slide-png'},
  },
}));

// Mock Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        success: 'green',
        border: 'gray',
        white: '#fff',
      },
      typography: {
        labelXsBold: {fontFamily: 'Arial'},
        h3: {fontFamily: 'Arial'},
      },
      spacing: {},
      borderRadius: {},
      shadows: {},
    },
  }),
}));

// Mock Utils
jest.mock('@/shared/utils/cardStyles', () => ({
  createGlassCardStyles: () => ({card: {}, fallback: {}}),
  createCardContentStyles: () => ({content: {}}),
  createTextContainerStyles: () => ({textContainer: {}}),
}));

// Mock Currency Utils
jest.mock('@/shared/utils/currency', () => ({
  formatCurrency: jest.fn((amount, opts) => {
    // Simple mock implementation
    if (opts.currencyCode === 'FAIL') throw new Error('Format failed');
    return `${opts.currencyCode} ${amount}`;
  }),
  resolveCurrencySymbol: jest.fn((code, fallback) =>
    code === 'USD' ? '$' : fallback,
  ),
}));

// Mock LiquidGlassCard (Named Export)
jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => {
  const {View} = require('react-native');
  return {
    LiquidGlassCard: (props: any) => (
      <View testID="liquid-glass-card">{props.children}</View>
    ),
  };
});

// Mock SwipeableGlassCard (Named Export)
jest.mock(
  '@/shared/components/common/SwipeableGlassCard/SwipeableGlassCard',
  () => {
    const {View} = require('react-native');
    return {
      SwipeableGlassCard: (props: any) => (
        <View testID="swipeable-glass-card">
          {props.children}
          {/* Helper to trigger action for testing */}
          <View testID="swipe-trigger" onTouchEnd={props.onAction} />
        </View>
      ),
    };
  },
);

describe('YearlySpendCard Component', () => {
  const mockOnPressView = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering Logic
  // ===========================================================================

  it('renders correctly with default props', () => {
    const {getByText, getByTestId} = render(
      <YearlySpendCard onPressView={mockOnPressView} />,
    );

    expect(getByText('Yearly spend summary')).toBeTruthy();
    // Default mock returns "USD 0"
    expect(getByText('USD 0')).toBeTruthy();
    expect(getByTestId('swipeable-glass-card')).toBeTruthy();
  });

  it('renders companion avatar when provided', () => {
    const mockAvatar = {uri: 'avatar.png'};
    const {UNSAFE_getAllByType} = render(
      <YearlySpendCard companionAvatar={mockAvatar} />,
    );

    // Should find wallet icon + companion avatar
    const images = UNSAFE_getAllByType(Image);
    const avatar = images.find(img => img.props.source === mockAvatar);
    expect(avatar).toBeTruthy();
  });

  // ===========================================================================
  // 2. Logic (Currency & Formatting)
  // ===========================================================================

  it('formats currency correctly using props', () => {
    const {getByText} = render(
      <YearlySpendCard amount={1000} currencyCode="EUR" />,
    );
    // Mock returns "EUR 1000"
    expect(getByText('EUR 1000')).toBeTruthy();
  });

  it('handles formatting error gracefully (catch block coverage)', () => {
    // We configured the mock to throw if currencyCode is 'FAIL'
    const {getByText} = render(
      <YearlySpendCard amount={500} currencyCode="FAIL" currencySymbol="€" />,
    );

    // Should fall back to `${resolvedSymbol} ${amount}` -> "€ 500"
    expect(getByText('€ 500')).toBeTruthy();
  });

  it('resolves currency symbol via util if not provided', () => {
    // currencyCode 'USD' resolves to '$' in our mock
    // This test ensures that the memoized resolvedSymbol logic is executed
    // If we pass FAIL code but NO symbol, it should use fallback '$' from resolveCurrencySymbol mock default
    const {getByText} = render(
      <YearlySpendCard amount={123} currencyCode="FAIL" />, // No symbol provided
    );
    // resolveCurrencySymbol('FAIL', '$') -> returns '$'
    // catch block -> '$ 123'
    expect(getByText('$ 123')).toBeTruthy();
  });

  // ===========================================================================
  // 3. Interaction
  // ===========================================================================

  it('calls onPressView when card content is pressed', () => {
    const {UNSAFE_getByType} = render(
      <YearlySpendCard onPressView={mockOnPressView} />,
    );

    const touchable = UNSAFE_getByType(TouchableOpacity);
    fireEvent.press(touchable);
    expect(mockOnPressView).toHaveBeenCalledTimes(1);
  });

  it('calls onPressView when swipe action is triggered', () => {
    const {getByTestId} = render(
      <YearlySpendCard onPressView={mockOnPressView} />,
    );

    const trigger = getByTestId('swipe-trigger');
    fireEvent(trigger, 'onTouchEnd');
    expect(mockOnPressView).toHaveBeenCalledTimes(1);
  });

  // ===========================================================================
  // 4. Conditional Rendering (disableSwipe)
  // ===========================================================================

  it('renders LiquidGlassCard (no swipe) when disableSwipe is true', () => {
    const {getByTestId, queryByTestId} = render(
      <YearlySpendCard disableSwipe={true} />,
    );

    expect(getByTestId('liquid-glass-card')).toBeTruthy();
    expect(queryByTestId('swipeable-glass-card')).toBeNull();
  });
});
