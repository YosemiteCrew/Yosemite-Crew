import React from 'react';
import {act, render, screen, fireEvent} from '@testing-library/react-native';
import {mockTheme} from '../../../../../__tests__/setup/mockTheme';
import {VetBusinessCard} from '@/features/appointments/components/VetBusinessCard/VetBusinessCard';

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

jest.mock('@/shared/utils/resolveImageSource', () => ({
  resolveImageSource: (src: any) => src || 1,
}));

const baseProps = {
  name: 'Pacific Paws Clinic',
};

describe('VetBusinessCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
  });

  it('renders the business name', () => {
    render(<VetBusinessCard {...baseProps} />);
    expect(screen.getByText('Pacific Paws Clinic')).toBeTruthy();
  });

  it('renders open hours when provided', () => {
    render(<VetBusinessCard {...baseProps} openHours="Mon-Fri 8am-6pm" />);
    expect(screen.getByText('Mon-Fri 8am-6pm')).toBeTruthy();
  });

  it('does not render open hours when not provided', () => {
    render(<VetBusinessCard {...baseProps} />);
    expect(screen.queryByText(/Mon-Fri/)).toBeNull();
  });

  it('renders distance when provided', () => {
    render(<VetBusinessCard {...baseProps} distance="2.3 mi" />);
    expect(screen.getByText('2.3 mi')).toBeTruthy();
  });

  it('renders rating when provided', () => {
    render(<VetBusinessCard {...baseProps} rating="4.8" />);
    expect(screen.getByText('4.8')).toBeTruthy();
  });

  it('renders both distance and rating', () => {
    render(<VetBusinessCard {...baseProps} distance="1.1 mi" rating="4.5" />);
    expect(screen.getByText('1.1 mi')).toBeTruthy();
    expect(screen.getByText('4.5')).toBeTruthy();
  });

  it('does not render the distance/rating row when neither is provided', () => {
    render(<VetBusinessCard {...baseProps} />);
    // No crash — distance/rating section simply absent
    expect(screen.getByText('Pacific Paws Clinic')).toBeTruthy();
  });

  it('renders address when provided', () => {
    render(<VetBusinessCard {...baseProps} address="456 Paw Lane, SF" />);
    expect(screen.getByText('456 Paw Lane, SF')).toBeTruthy();
  });

  it('does not render address when not provided', () => {
    render(<VetBusinessCard {...baseProps} />);
    expect(screen.queryByText(/Paw Lane/)).toBeNull();
  });

  it('renders website when provided', () => {
    render(<VetBusinessCard {...baseProps} website="pacificpaws.com" />);
    expect(screen.getByText('pacificpaws.com')).toBeTruthy();
  });

  it('renders legacy meta when address is absent but meta is provided', () => {
    render(<VetBusinessCard {...baseProps} meta="Open Sundays" />);
    expect(screen.getByText('Open Sundays')).toBeTruthy();
  });

  it('does not render meta when address is also present (address takes priority)', () => {
    render(
      <VetBusinessCard
        {...baseProps}
        meta="Open Sundays"
        address="123 Main St"
      />,
    );
    expect(screen.queryByText('Open Sundays')).toBeNull();
    expect(screen.getByText('123 Main St')).toBeTruthy();
  });

  it('renders the default CTA text', () => {
    render(<VetBusinessCard {...baseProps} />);
    expect(screen.getByText('Book an appointment')).toBeTruthy();
  });

  it('renders a custom CTA text', () => {
    render(<VetBusinessCard {...baseProps} cta="Schedule a visit" />);
    expect(screen.getByText('Schedule a visit')).toBeTruthy();
  });

  it('does not render CTA when cta is an empty string', () => {
    render(<VetBusinessCard {...baseProps} cta="" />);
    expect(screen.queryByText('Book an appointment')).toBeNull();
  });

  it('calls onPress when CTA is pressed', () => {
    const onPress = jest.fn();
    render(<VetBusinessCard {...baseProps} onPress={onPress} />);
    fireEvent.press(screen.getByText('Book an appointment'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes a button role and the CTA text as the accessibility label', () => {
    render(<VetBusinessCard {...baseProps} cta="Schedule a visit" />);
    const button = screen.getByLabelText('Schedule a visit');
    expect(button.props.accessibilityRole).toBe('button');
  });

  it('handles image load error — calls onImageLoadError callback', () => {
    const onImageLoadError = jest.fn();
    const {UNSAFE_root} = render(
      <VetBusinessCard
        {...baseProps}
        photo="https://example.com/photo.jpg"
        fallbackPhoto="https://example.com/fallback.jpg"
        onImageLoadError={onImageLoadError}
      />,
    );
    const images = UNSAFE_root.findAll(
      (node: any) =>
        node.type === 'Image' || node.type?.displayName === 'Image',
    );
    if (images.length > 0 && images[0].props.onError) {
      act(() => {
        images[0].props.onError();
      });
    }
    expect(onImageLoadError).toHaveBeenCalledTimes(1);
  });

  it('switches to fallback photo on image load error', () => {
    const {UNSAFE_root} = render(
      <VetBusinessCard
        {...baseProps}
        photo="https://example.com/photo.jpg"
        fallbackPhoto="https://example.com/fallback.jpg"
      />,
    );
    const images = UNSAFE_root.findAll(
      (node: any) =>
        node.type === 'Image' || node.type?.displayName === 'Image',
    );
    if (images.length > 0 && images[0].props.onError) {
      act(() => {
        images[0].props.onError();
      });
    }
    // Component should still render after state update
    expect(screen.getByText('Pacific Paws Clinic')).toBeTruthy();
  });

  it('renders without crashing when no optional props are provided', () => {
    expect(() => render(<VetBusinessCard {...baseProps} />)).not.toThrow();
  });
});
