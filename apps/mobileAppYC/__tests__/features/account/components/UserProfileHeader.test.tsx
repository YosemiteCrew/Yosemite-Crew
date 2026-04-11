import React from 'react';
import {render} from '@testing-library/react-native';
import {UserProfileHeader} from '../../../../src/features/account/components/UserProfileHeader';

// --- Mocks ---

// Mock the child component ProfileHeader to verify props passed to it
jest.mock(
  '../../../../src/shared/components/common/ProfileHeader/ProfileHeader',
  () => {
    const {View: RNView, Text: RNText} = require('react-native');

    return {
      ProfileHeader: (props: any) => (
        <RNView testID="mock-profile-header">
          <RNText testID="header-title">{props.title}</RNText>
          <RNText testID="header-fallback">{props.fallbackInitial}</RNText>
          <RNText testID="header-props">
            {JSON.stringify({
              size: props.size,
              showCameraButton: props.showCameraButton,
              profileImage: props.profileImage,
            })}
          </RNText>
        </RNView>
      ),
    };
  },
);

describe('UserProfileHeader', () => {
  const mockPickerRef = {current: null};
  const mockOnImageSelected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Logic: Name & Initial Derivation (Branch Coverage)
  // ===========================================================================

  it('formats full name and initial correctly when both names provided', () => {
    const {getByTestId} = render(
      <UserProfileHeader
        firstName="John"
        lastName="Doe"
        pickerRef={mockPickerRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    expect(getByTestId('header-title').props.children).toBe('John Doe');
    expect(getByTestId('header-fallback').props.children).toBe('J');
  });

  it('handles rendering with only First Name', () => {
    const {getByTestId} = render(
      <UserProfileHeader
        firstName="Alice"
        lastName=""
        pickerRef={mockPickerRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    expect(getByTestId('header-title').props.children).toBe('Alice');
    expect(getByTestId('header-fallback').props.children).toBe('A');
  });

  it('handles rendering with only Last Name (fallback logic branch)', () => {
    const {getByTestId} = render(
      <UserProfileHeader
        firstName=""
        lastName="Smith"
        pickerRef={mockPickerRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    expect(getByTestId('header-title').props.children).toBe('Smith');
    expect(getByTestId('header-fallback').props.children).toBe('S');
  });

  it('handles empty names with defaults (fallback logic branch)', () => {
    const {getByTestId} = render(
      <UserProfileHeader
        firstName=""
        lastName=""
        pickerRef={mockPickerRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    expect(getByTestId('header-title').props.children).toBe('User Profile');
    expect(getByTestId('header-fallback').props.children).toBe('U');
  });

  // ===========================================================================
  // 2. Rendering & Prop Forwarding
  // ===========================================================================

  it('passes optional props (size, showCameraButton, image) correctly', () => {
    const {getByTestId} = render(
      <UserProfileHeader
        firstName="John"
        lastName="Doe"
        pickerRef={mockPickerRef}
        onImageSelected={mockOnImageSelected}
        size={150}
        showCameraButton={false}
        profileImage="https://example.com/avatar.jpg"
      />,
    );

    const propsText = getByTestId('header-props').props.children;
    const props = JSON.parse(propsText as string);

    expect(props.size).toBe(150);
    expect(props.showCameraButton).toBe(false);
    expect(props.profileImage).toBe('https://example.com/avatar.jpg');
  });

  it('uses default values for optional props when undefined', () => {
    const {getByTestId} = render(
      <UserProfileHeader
        firstName="John"
        lastName="Doe"
        pickerRef={mockPickerRef}
        onImageSelected={mockOnImageSelected}
        // size & showCameraButton omitted
      />,
    );

    const propsText = getByTestId('header-props').props.children;
    const props = JSON.parse(propsText as string);

    // Assert defaults defined in component destructuring
    expect(props.size).toBe(100);
    expect(props.showCameraButton).toBe(true);
  });
});
