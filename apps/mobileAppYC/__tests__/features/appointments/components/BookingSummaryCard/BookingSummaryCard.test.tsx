import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import {BookingSummaryCard} from '../../../../../src/features/appointments/components/BookingSummaryCard/BookingSummaryCard';

// --- Mocks ---

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: mockGoBack}),
}));

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => ({
  LiquidGlassCard: ({children, style, fallbackStyle}: any) => {
    const {View} = require('react-native');
    return (
      <View testID="liquid-glass-card" style={[style, fallbackStyle]}>
        {children}
      </View>
    );
  },
}));

jest.mock(
  '@/shared/components/common/SwipeableGlassCard/SwipeableGlassCard',
  () => ({
    SwipeableGlassCard: ({children, onAction}: any) => {
      const {View, TouchableOpacity} = require('react-native');
      return (
        <View testID="swipeable-glass-card">
          <TouchableOpacity testID="swipe-action" onPress={onAction} />
          {children}
        </View>
      );
    },
  }),
);

jest.mock('@/assets/images', () => ({
  Images: {
    hospitalIcon: {uri: 'mock-hospital-icon'},
    editIconSlide: {uri: 'mock-edit-icon'},
  },
}));

// --- Tests ---

describe('BookingSummaryCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title', () => {
    const {getByText} = render(<BookingSummaryCard title="City Vet Clinic" />);
    expect(getByText('City Vet Clinic')).toBeTruthy();
  });

  it('renders subtitlePrimary when provided', () => {
    const {getByText} = render(
      <BookingSummaryCard title="Clinic" subtitlePrimary="Mon–Fri 9am–5pm" />,
    );
    expect(getByText('Mon–Fri 9am–5pm')).toBeTruthy();
  });

  it('does not render subtitlePrimary when null', () => {
    const {queryByText} = render(
      <BookingSummaryCard title="Clinic" subtitlePrimary={null} />,
    );
    expect(queryByText(/Mon/)).toBeNull();
  });

  it('renders subtitleSecondary when provided', () => {
    const {getByText} = render(
      <BookingSummaryCard title="Clinic" subtitleSecondary="123 Main St" />,
    );
    expect(getByText('123 Main St')).toBeTruthy();
  });

  it('does not render subtitleSecondary when null', () => {
    const {queryByText} = render(
      <BookingSummaryCard title="Clinic" subtitleSecondary={null} />,
    );
    expect(queryByText(/Main/)).toBeNull();
  });

  it('renders badgeText when provided', () => {
    const {getByText} = render(
      <BookingSummaryCard title="Clinic" badgeText="Open" />,
    );
    expect(getByText('Open')).toBeTruthy();
  });

  it('does not render badge when badgeText is null', () => {
    const {queryByText} = render(
      <BookingSummaryCard title="Clinic" badgeText={null} />,
    );
    expect(queryByText('Open')).toBeNull();
  });

  it('renders Image when showAvatar is true (default)', () => {
    const {UNSAFE_getAllByType} = render(
      <BookingSummaryCard
        title="Clinic"
        image={{uri: 'https://img.com/a.jpg'}}
      />,
    );
    const {Image} = require('react-native');
    expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
  });

  it('does not render Image when showAvatar is false', () => {
    const {UNSAFE_queryAllByType} = render(
      <BookingSummaryCard title="Clinic" showAvatar={false} />,
    );
    const {Image} = require('react-native');
    expect(UNSAFE_queryAllByType(Image).length).toBe(0);
  });

  it('calls onPress when the card is pressed', () => {
    const onPress = jest.fn();
    const {getByText} = render(
      <BookingSummaryCard title="Clinic" onPress={onPress} />,
    );
    fireEvent.press(getByText('Clinic'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes a button role and label derived from the title', () => {
    const {getByLabelText} = render(
      <BookingSummaryCard title="Clinic" onPress={jest.fn()} />,
    );
    const card = getByLabelText('View Clinic details');
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityState).toEqual({disabled: false});
  });

  it('marks the card as disabled to screen readers when no onPress is given', () => {
    const {getByLabelText} = render(<BookingSummaryCard title="Clinic" />);
    const card = getByLabelText('View Clinic details');
    expect(card.props.accessibilityState).toEqual({disabled: true});
  });

  it('uses SwipeableGlassCard when interactive (default)', () => {
    const {getByTestId} = render(<BookingSummaryCard title="Clinic" />);
    expect(getByTestId('swipeable-glass-card')).toBeTruthy();
  });

  it('uses LiquidGlassCard when interactive=false', () => {
    const {getByTestId} = render(
      <BookingSummaryCard title="Clinic" interactive={false} />,
    );
    expect(getByTestId('liquid-glass-card')).toBeTruthy();
  });

  it('calls onEdit callback when swipe action fires', () => {
    const onEdit = jest.fn();
    const {getByTestId} = render(
      <BookingSummaryCard title="Clinic" onEdit={onEdit} />,
    );
    fireEvent.press(getByTestId('swipe-action'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('calls navigation.goBack when no onEdit callback', () => {
    const {getByTestId} = render(<BookingSummaryCard title="Clinic" />);
    fireEvent.press(getByTestId('swipe-action'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  // resolveImageSource branches
  it('accepts a numeric (require) image source', () => {
    expect(() =>
      render(<BookingSummaryCard title="Clinic" image={1} />),
    ).not.toThrow();
  });

  it('accepts a string URI as image source', () => {
    expect(() =>
      render(
        <BookingSummaryCard
          title="Clinic"
          image="https://img.com/a.jpg"
          as
          any
        />,
      ),
    ).not.toThrow();
  });

  it('accepts an object with uri as image source', () => {
    expect(() =>
      render(
        <BookingSummaryCard
          title="Clinic"
          image={{uri: 'https://img.com/a.jpg'}}
        />,
      ),
    ).not.toThrow();
  });

  it('falls back to hospitalIcon when image is null', () => {
    expect(() =>
      render(<BookingSummaryCard title="Clinic" image={null} />),
    ).not.toThrow();
  });

  it('falls back to hospitalIcon when image object has no uri', () => {
    expect(() =>
      render(<BookingSummaryCard title="Clinic" image={{} as any} />),
    ).not.toThrow();
  });

  it('accepts an array image source and uses first item', () => {
    expect(() =>
      render(
        <BookingSummaryCard
          title="Clinic"
          image={[{uri: 'https://img.com/a.jpg'}] as any}
        />,
      ),
    ).not.toThrow();
  });

  it('falls back to hospitalIcon when image is an empty array', () => {
    expect(() =>
      render(<BookingSummaryCard title="Clinic" image={[] as any} />),
    ).not.toThrow();
  });
});
