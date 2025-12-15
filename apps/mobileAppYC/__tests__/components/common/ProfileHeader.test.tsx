import React from 'react';
import {Image} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import {ProfileHeader} from '../../../src/shared/components/common/ProfileHeader/ProfileHeader';

// --- Mocks ---

// 1. Mock Images
jest.mock('@/assets/images', () => ({
  Images: {
    cameraIcon: {uri: 'camera-icon-png'},
  },
}));

// 2. Mock useTheme
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        secondary: '#333333',
        white: '#ffffff',
        textSecondary: '#666666',
      },
      spacing: {
        '1': 4,
        '4': 16,
        '6': 24,
      },
      typography: {
        h4: {fontSize: 24, fontWeight: 'bold'},
        labelMdBold: {fontSize: 14, fontWeight: '700'},
      },
    },
  }),
}));

// 3. Mock ProfileImagePicker
// We use forwardRef here to ensure the ref prop passed from ProfileHeader
// is strictly handled, allowing us to control what `current` becomes.
jest.mock(
  '../../../src/shared/components/common/ProfileImagePicker/ProfileImagePicker',
  () => {
    const {View: RNView} = require('react-native');
    const ReactLib = require('react');
    return {
      ProfileImagePicker: ReactLib.forwardRef((props: any, _ref: any) => {
        // We don't necessarily need to modify ref here because
        // we control the ref object passed into ProfileHeader from the test.
        // But React warns if functional components get refs without forwardRef.
        return <RNView testID="mock-profile-picker" {...props} />;
      }),
    };
  },
);

describe('ProfileHeader Component', () => {
  const mockOnImageSelected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering & Display Logic
  // ===========================================================================

  it('renders correctly with required props (Title only)', () => {
    const mockRef = {current: null};
    const {getByText, queryByText, getByTestId} = render(
      <ProfileHeader
        title="John Doe"
        pickerRef={mockRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    // Should render title
    expect(getByText('John Doe')).toBeTruthy();
    // Should NOT render subtitle
    expect(queryByText('subtitle')).toBeNull();
    // Should render the picker component
    expect(getByTestId('mock-profile-picker')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    const mockRef = {current: null};
    const {getByText} = render(
      <ProfileHeader
        title="John Doe"
        subtitle="Software Engineer"
        pickerRef={mockRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    expect(getByText('Software Engineer')).toBeTruthy();
  });

  it('does NOT render subtitle when explicitly null', () => {
    const mockRef = {current: null};
    const {toJSON} = render(
      <ProfileHeader
        title="John Doe"
        subtitle={null}
        pickerRef={mockRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    // Check coverage mainly, but visually verifying output:
    const root = toJSON();
    // @ts-ignore
    const subtitleNodes = root.children.filter(
      (c: any) => c.type === 'Text' && c.props.children === null,
    );
    expect(subtitleNodes.length).toBe(0);
  });

  // ===========================================================================
  // 2. Camera Button Logic
  // ===========================================================================

  it('renders camera button by default', () => {
    const mockRef = {current: null};
    const {UNSAFE_getAllByType} = render(
      <ProfileHeader
        title="John"
        pickerRef={mockRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    const images = UNSAFE_getAllByType(Image);
    const cameraIcon = images.find(
      i => i.props.source.uri === 'camera-icon-png',
    );
    expect(cameraIcon).toBeTruthy();
  });

  it('does NOT render camera button when showCameraButton is false', () => {
    const mockRef = {current: null};
    const {UNSAFE_queryAllByType} = render(
      <ProfileHeader
        title="John"
        pickerRef={mockRef}
        onImageSelected={mockOnImageSelected}
        showCameraButton={false}
      />,
    );

    const images = UNSAFE_queryAllByType(Image);
    const cameraIcon = images.find(
      i => i.props.source?.uri === 'camera-icon-png',
    );
    expect(cameraIcon).toBeUndefined();
  });

  it('calls triggerPicker on the ref when camera button is pressed', () => {
    const triggerPickerMock = jest.fn();
    // Pre-fill the ref with the method before render
    const mockRef = {current: {triggerPicker: triggerPickerMock}};

    const {UNSAFE_getByType} = render(
      <ProfileHeader
        title="John"
        pickerRef={mockRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    const cameraIcon = UNSAFE_getByType(Image);
    const cameraButton = cameraIcon.parent;

    fireEvent.press(cameraButton as any);

    expect(triggerPickerMock).toHaveBeenCalledTimes(1);
  });

  it('does not crash if camera button is pressed but ref.current is null', () => {
    // Explicitly set current to null
    const mockRef = {current: null};

    const {UNSAFE_getByType} = render(
      <ProfileHeader
        title="John"
        pickerRef={mockRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    const cameraIcon = UNSAFE_getByType(Image);
    const cameraButton = cameraIcon.parent;

    expect(() => fireEvent.press(cameraButton as any)).not.toThrow();
  });

  // ===========================================================================
  // 3. Fallback Text Logic & Props Passing
  // ===========================================================================

  it('calculates fallbackText correctly from title (default behavior)', () => {
    const mockRef = {current: null};
    const {getByTestId} = render(
      <ProfileHeader
        title="Alice"
        pickerRef={mockRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    const picker = getByTestId('mock-profile-picker');
    // title.charAt(0) -> 'A'
    expect(picker.props.fallbackText).toBe('A');
  });

  it('calculates fallbackText using fallbackInitial when provided', () => {
    const mockRef = {current: null};
    const {getByTestId} = render(
      <ProfileHeader
        title="Bob"
        fallbackInitial="Z"
        pickerRef={mockRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    const picker = getByTestId('mock-profile-picker');
    expect(picker.props.fallbackText).toBe('Z');
  });

  it('handles empty title fallback edge case', () => {
    const mockRef = {current: null};
    const {getByTestId} = render(
      <ProfileHeader
        title="" // Empty string
        pickerRef={mockRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    const picker = getByTestId('mock-profile-picker');
    // "" charAt(0) is "" -> toString -> toUpperCase -> ""
    expect(picker.props.fallbackText).toBe('');
  });

  it('passes other props (size, imageUri) to ProfileImagePicker correctly', () => {
    const testImage = 'https://example.com/me.jpg';
    const testSize = 150;
    const mockRef = {current: null};

    const {getByTestId} = render(
      <ProfileHeader
        title="Test"
        profileImage={testImage}
        size={testSize}
        pickerRef={mockRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    const picker = getByTestId('mock-profile-picker');
    expect(picker.props.imageUri).toBe(testImage);
    expect(picker.props.size).toBe(testSize);
    expect(picker.props.pressable).toBe(false);
  });

  it('passes undefined to ProfileImagePicker if profileImage is null', () => {
    const mockRef = {current: null};
    const {getByTestId} = render(
      <ProfileHeader
        title="Test"
        profileImage={null}
        pickerRef={mockRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    const picker = getByTestId('mock-profile-picker');
    expect(picker.props.imageUri).toBeUndefined();
  });
});
