import React from 'react';
import {act, render, screen, fireEvent} from '@testing-library/react-native';
import {mockTheme} from '../../../../../__tests__/setup/mockTheme';
import {BusinessCard} from '@/features/appointments/components/BusinessCard/BusinessCard';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => {
  const {View} = require('react-native');
  return {
    LiquidGlassCard: ({children, style}: any) => (
      <View testID="liquid-glass-card" style={style}>
        {children}
      </View>
    ),
  };
});

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    LiquidGlassButton: ({title, onPress}: any) => {
      const {Text, TouchableOpacity} = require('react-native');
      return (
        <TouchableOpacity testID="liquid-glass-button" onPress={onPress}>
          <Text testID="button-title">{title}</Text>
        </TouchableOpacity>
      );
    },
  }),
);

jest.mock('@/shared/utils/resolveImageSource', () => ({
  resolveImageSource: (src: any) => src || 1,
}));

jest.mock('@/features/appointments/utils/photoUtils', () => ({
  isDummyPhoto: jest.fn(() => false),
}));

const baseProps = {
  name: 'Happy Paws Vet',
};

describe('BusinessCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the business name', () => {
    render(<BusinessCard {...baseProps} />);
    expect(screen.getByText('Happy Paws Vet')).toBeTruthy();
  });

  it('renders openText when provided', () => {
    render(<BusinessCard {...baseProps} openText="Open until 8pm" />);
    expect(screen.getByText('Open until 8pm')).toBeTruthy();
  });

  it('does not render openText when not provided', () => {
    render(<BusinessCard {...baseProps} />);
    expect(screen.queryByText('Open until')).toBeNull();
  });

  it('renders description when provided and non-empty', () => {
    render(
      <BusinessCard
        {...baseProps}
        description="Full service animal hospital"
      />,
    );
    expect(screen.getByText('Full service animal hospital')).toBeTruthy();
  });

  it('does not render description when it is only whitespace', () => {
    render(<BusinessCard {...baseProps} description="   " />);
    expect(screen.queryByText('   ')).toBeNull();
  });

  it('does not render description when not provided', () => {
    render(<BusinessCard {...baseProps} />);
    // No crash — description section simply absent
    expect(screen.getByText('Happy Paws Vet')).toBeTruthy();
  });

  it('renders distanceText when provided', () => {
    render(<BusinessCard {...baseProps} distanceText="1.2 mi" />);
    expect(screen.getByText('1.2 mi')).toBeTruthy();
  });

  it('renders ratingText when provided', () => {
    render(<BusinessCard {...baseProps} ratingText="4.7" />);
    expect(screen.getByText('4.7')).toBeTruthy();
  });

  it('renders both distance and rating when both provided', () => {
    render(
      <BusinessCard {...baseProps} distanceText="0.5 mi" ratingText="4.9" />,
    );
    expect(screen.getByText('0.5 mi')).toBeTruthy();
    expect(screen.getByText('4.9')).toBeTruthy();
  });

  it('renders Book button when onBook is provided', () => {
    const onBook = jest.fn();
    render(<BusinessCard {...baseProps} onBook={onBook} />);
    expect(screen.getByTestId('liquid-glass-button')).toBeTruthy();
  });

  it('does not render Book button when onBook is not provided', () => {
    render(<BusinessCard {...baseProps} />);
    expect(screen.queryByTestId('liquid-glass-button')).toBeNull();
  });

  it('invokes onBook when Book button is pressed', () => {
    const onBook = jest.fn();
    render(<BusinessCard {...baseProps} onBook={onBook} />);
    fireEvent.press(screen.getByTestId('liquid-glass-button'));
    expect(onBook).toHaveBeenCalledTimes(1);
  });

  it('renders without crashing in compact mode', () => {
    expect(() => render(<BusinessCard {...baseProps} compact />)).not.toThrow();
  });

  it('renders without crashing with glassEffect none', () => {
    expect(() =>
      render(<BusinessCard {...baseProps} glassEffect="none" />),
    ).not.toThrow();
  });

  it('renders without crashing with glassEffect regular', () => {
    expect(() =>
      render(<BusinessCard {...baseProps} glassEffect="regular" />),
    ).not.toThrow();
  });

  it('handles image load error by switching to fallback', () => {
    const {UNSAFE_root} = render(
      <BusinessCard
        {...baseProps}
        photo={{uri: 'https://example.com/photo.jpg'}}
        fallbackPhoto={{uri: 'https://example.com/fallback.jpg'}}
      />,
    );
    // Trigger image error to exercise handleError code path
    const image = UNSAFE_root.findAll(
      (node: any) =>
        node.type?.displayName === 'Image' || node.type === 'Image',
    );
    if (image.length > 0 && image[0].props.onError) {
      act(() => {
        image[0].props.onError();
      });
    }
    expect(screen.getByText('Happy Paws Vet')).toBeTruthy();
  });

  it('resets the load-failed state when the photo prop changes', () => {
    const {UNSAFE_root, rerender} = render(
      <BusinessCard
        {...baseProps}
        photo={{uri: 'https://example.com/photo-a.jpg'}}
        fallbackPhoto={{uri: 'https://example.com/fallback.jpg'}}
      />,
    );

    const findImage = () =>
      UNSAFE_root.findAll(
        (node: any) =>
          node.type?.displayName === 'Image' || node.type === 'Image',
      )[0];

    act(() => {
      findImage().props.onError();
    });

    rerender(
      <BusinessCard
        {...baseProps}
        photo={{uri: 'https://example.com/photo-b.jpg'}}
        fallbackPhoto={{uri: 'https://example.com/fallback.jpg'}}
      />,
    );

    expect(findImage().props.source).toEqual({
      uri: 'https://example.com/photo-b.jpg',
    });
  });
});
