import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {RatingStars} from '../../../src/shared/components/common/RatingStars/RatingStars';
import {Image} from 'react-native';

// --- Mocks ---

// Mock Images asset
jest.mock('@/assets/images', () => ({
  Images: {
    starSolid: {uri: 'star-solid-png'},
    starOutline: {uri: 'star-outline-png'},
  },
}));

// Mock useTheme hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: '#FFD700',
      },
    },
  }),
}));

describe('RatingStars Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering Logic
  // ===========================================================================

  it('renders 5 stars correctly', () => {
    const {UNSAFE_getAllByType} = render(<RatingStars value={3} />);
    const images = UNSAFE_getAllByType(Image);
    expect(images).toHaveLength(5);
  });

  it('displays correct solid/outline stars based on value', () => {
    const {UNSAFE_getAllByType} = render(<RatingStars value={3} />);
    const images = UNSAFE_getAllByType(Image);

    // Stars 1-3 should be solid
    expect(images[0].props.source).toEqual({uri: 'star-solid-png'});
    expect(images[1].props.source).toEqual({uri: 'star-solid-png'});
    expect(images[2].props.source).toEqual({uri: 'star-solid-png'});

    // Stars 4-5 should be outline
    expect(images[3].props.source).toEqual({uri: 'star-outline-png'});
    expect(images[4].props.source).toEqual({uri: 'star-outline-png'});
  });

  it('renders all solid stars when value is 5', () => {
    const {UNSAFE_getAllByType} = render(<RatingStars value={5} />);
    const images = UNSAFE_getAllByType(Image);
    images.forEach(img => {
      expect(img.props.source).toEqual({uri: 'star-solid-png'});
    });
  });

  it('renders all outline stars when value is 0', () => {
    const {UNSAFE_getAllByType} = render(<RatingStars value={0} />);
    const images = UNSAFE_getAllByType(Image);
    images.forEach(img => {
      expect(img.props.source).toEqual({uri: 'star-outline-png'});
    });
  });

  // ===========================================================================
  // 2. Interaction
  // ===========================================================================

  it('calls onChange with the correct value when a star is pressed', () => {
    const mockOnChange = jest.fn();
    const {UNSAFE_getAllByType} = render(
      <RatingStars value={0} onChange={mockOnChange} />,
    );

    const images = UNSAFE_getAllByType(Image);

    // Press the 4th star (index 3)
    fireEvent.press(images[3].parent as any);

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(4);
  });

  it('does not crash when pressed if onChange is undefined', () => {
    const {UNSAFE_getAllByType} = render(<RatingStars value={0} />);
    const images = UNSAFE_getAllByType(Image);

    expect(() => fireEvent.press(images[0].parent as any)).not.toThrow();
  });

  // ===========================================================================
  // 3. Styling & Props
  // ===========================================================================

  it('applies custom size prop to styles', () => {
    const customSize = 40;
    const {UNSAFE_getAllByType} = render(
      <RatingStars value={3} size={customSize} />,
    );
    const images = UNSAFE_getAllByType(Image);

    // Check style of first star
    // Style is typically an array in React Native [baseStyle, override]
    const style = images[0].props.style;
    const flattenedStyle = Array.isArray(style)
      ? Object.assign({}, ...style)
      : style;

    expect(flattenedStyle).toHaveProperty('width', customSize);
    expect(flattenedStyle).toHaveProperty('height', customSize);
  });

  it('uses default size of 20 if size prop is not provided', () => {
    const {UNSAFE_getAllByType} = render(<RatingStars value={3} />);
    const images = UNSAFE_getAllByType(Image);

    const style = images[0].props.style;
    const flattenedStyle = Array.isArray(style)
      ? Object.assign({}, ...style)
      : style;

    expect(flattenedStyle).toHaveProperty('width', 20);
    expect(flattenedStyle).toHaveProperty('height', 20);
  });
});
