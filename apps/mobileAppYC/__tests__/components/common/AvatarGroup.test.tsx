import React from 'react';
import {Image, StyleSheet} from 'react-native';
import {render} from '@testing-library/react-native';
import {
  AvatarGroup,
} from '../../../src/shared/components/common/AvatarGroup/AvatarGroup';

// --- Mocks ---

// Mock useTheme hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        surface: '#ffffff',
        lightBlueBackground: '#e6f7ff',
        primary: '#0000ff',
      },
      typography: {
        titleSmall: {fontSize: 14, fontWeight: 'bold'},
      },
    },
  }),
}));

describe('AvatarGroup Component', () => {
  const mockImage1 = {uri: 'http://image1.com'};
  const mockImage2 = {uri: 'http://image2.com'};
  const mockConfigImage = {source: {uri: 'http://image3.com'}};
  const mockConfigPlaceholder = {placeholder: 'A'};
  const mockRequireImage = 123; // Simulating require('./image.png')

  // ===========================================================================
  // 1. Rendering Logic
  // ===========================================================================

  it('renders standard image avatars correctly', () => {
    const {UNSAFE_getAllByType} = render(
      <AvatarGroup avatars={[mockImage1, mockImage2]} />,
    );
    const images = UNSAFE_getAllByType(Image);
    expect(images).toHaveLength(2);
    expect(images[0].props.source).toEqual(mockImage1);
    expect(images[1].props.source).toEqual(mockImage2);
  });

  it('renders placeholder avatars (initials) correctly', () => {
    const {getByText, UNSAFE_queryByType} = render(
      <AvatarGroup avatars={[mockConfigPlaceholder]} />,
    );

    // Should render the initial 'A'
    expect(getByText('A')).toBeTruthy();

    // Should NOT render an Image component
    // @ts-ignore
    expect(UNSAFE_queryByType(Image)).toBeNull();
  });

  it('renders mixed content (images + placeholders)', () => {
    const {getByText, UNSAFE_getAllByType} = render(
      <AvatarGroup avatars={[mockImage1, mockConfigPlaceholder]} />,
    );

    const images = UNSAFE_getAllByType(Image);
    expect(images).toHaveLength(1);
    expect(getByText('A')).toBeTruthy();
  });

  it('respects maxCount prop', () => {
    const avatars = [mockImage1, mockImage2, mockConfigPlaceholder];
    const {UNSAFE_getAllByType, queryByText} = render(
      <AvatarGroup avatars={avatars} maxCount={2} />,
    );

    const images = UNSAFE_getAllByType(Image);
    // Should only render first 2 items (which are images in this case)
    expect(images).toHaveLength(2);
    // The placeholder (3rd item) should be cut off
    expect(queryByText('A')).toBeNull();
  });

  it('applies correct overlap styles', () => {
    const {UNSAFE_getAllByType} = render(
      <AvatarGroup avatars={[mockImage1, mockImage2]} overlap={-10} />,
    );

    const images = UNSAFE_getAllByType(Image);

    // First item: marginLeft should be 0 (explicitly set by styles.avatarFirst)
    const style1 = StyleSheet.flatten(images[0].props.style);
    expect(style1).toHaveProperty('marginLeft', 0);

    // Second item: negative left margin
    const style2 = StyleSheet.flatten(images[1].props.style);
    expect(style2).toHaveProperty('marginLeft', -10);
  });

  // ===========================================================================
  // 3. Key Generation Logic (Unique Key Tests)
  // ===========================================================================

  it('generates keys for simple URI objects', () => {
    const {UNSAFE_getAllByType} = render(
      <AvatarGroup avatars={[mockImage1]} />,
    );
    expect(UNSAFE_getAllByType(Image)).toHaveLength(1);
  });

  it('generates keys for "require" (number) images', () => {
    // @ts-ignore
    const {UNSAFE_getAllByType} = render(
      <AvatarGroup avatars={[mockRequireImage]} />,
    );
    expect(UNSAFE_getAllByType(Image)).toHaveLength(1);
  });

  it('generates keys for Config objects with source URI', () => {
    const {UNSAFE_getAllByType} = render(
      <AvatarGroup avatars={[mockConfigImage]} />,
    );
    expect(UNSAFE_getAllByType(Image)).toHaveLength(1);
  });

  it('generates keys for Config objects with placeholder', () => {
    const {getByText} = render(
      <AvatarGroup avatars={[mockConfigPlaceholder]} />,
    );
    expect(getByText('A')).toBeTruthy();
  });

  it('generates fallback key for Config objects without URI or placeholder', () => {
    // This hits the `return 'config-${index}'` branch in getUniqueKey
    const weirdConfig = {source: {}}; // valid config structure but no uri
    // @ts-ignore
    const {UNSAFE_getAllByType} = render(
      <AvatarGroup avatars={[weirdConfig]} />,
    );

    // It will try to render an image with empty source
    expect(UNSAFE_getAllByType(Image)).toHaveLength(1);
  });

  it('generates fallback key for unknown object types', () => {
    // This hits `return 'avatar-${index}'`
    const unknownObj = {unknownProp: true};
    // @ts-ignore
    const {toJSON} = render(<AvatarGroup avatars={[unknownObj]} />);
    expect(toJSON()).toBeTruthy();
  });

  // ===========================================================================
  // 4. Styling Props
  // ===========================================================================

  it('passes custom size and borderWidth to styles', () => {
    const {UNSAFE_getAllByType} = render(
      <AvatarGroup avatars={[mockImage1]} size={50} borderWidth={5} />,
    );

    const images = UNSAFE_getAllByType(Image);
    const style = StyleSheet.flatten(images[0].props.style);

    expect(style).toHaveProperty('width', 50);
    expect(style).toHaveProperty('height', 50);
    expect(style).toHaveProperty('borderWidth', 5);
    expect(style).toHaveProperty('borderRadius', 25); // size / 2
  });
});
