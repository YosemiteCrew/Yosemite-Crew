import React from 'react';
import {render} from '@testing-library/react-native';
import CompanionProfileHeader from '../../../../src/features/companion/components/CompanionProfileHeader';
import {ProfileHeader} from '@/shared/components/common/ProfileHeader/ProfileHeader';

// --- Mocks ---

// Mock the shared ProfileHeader so we can verify the props passed to it
jest.mock('@/shared/components/common/ProfileHeader/ProfileHeader', () => ({
  ProfileHeader: jest.fn(() => null),
}));

describe('CompanionProfileHeader', () => {
  const mockPickerRef = {current: null};
  const mockOnImageSelected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Basic Props Passing ---
  it('passes all provided props correctly to the underlying ProfileHeader', () => {
    render(
      <CompanionProfileHeader
        name="Buddy"
        breedName="Golden Retriever"
        profileImage="http://test.com/img.jpg"
        pickerRef={mockPickerRef}
        onImageSelected={mockOnImageSelected}
        size={150}
        showCameraButton={false}
      />,
    );

    // Note: The second argument to a functional component call is 'context', which is undefined in this test environment.
    expect(ProfileHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Buddy',
        subtitle: 'Golden Retriever',
        profileImage: 'http://test.com/img.jpg',
        pickerRef: mockPickerRef,
        onImageSelected: mockOnImageSelected,
        size: 150,
        showCameraButton: false,
        fallbackInitial: 'B', // 'Buddy'.charAt(0).toUpperCase()
      }),
      undefined,
    );
  });

  // --- 2. Default Values (Branch Coverage) ---
  it('applies default values for optional props (size, showCameraButton)', () => {
    render(
      <CompanionProfileHeader
        name="Max"
        breedName="Poodle"
        pickerRef={mockPickerRef}
        onImageSelected={mockOnImageSelected}
        // size and showCameraButton are omitted to test defaults
      />,
    );

    expect(ProfileHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        size: 100, // Default
        showCameraButton: true, // Default
      }),
      undefined,
    );
  });

  // --- 3. Subtitle Fallback Logic ---
  it('falls back to "Unknown Breed" when breedName is null or undefined', () => {
    // Case 1: Undefined
    render(
      <CompanionProfileHeader
        name="Rover"
        // breedName is undefined
        pickerRef={mockPickerRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    expect(ProfileHeader).toHaveBeenLastCalledWith(
      expect.objectContaining({subtitle: 'Unknown Breed'}),
      undefined,
    );

    // Case 2: Null
    render(
      <CompanionProfileHeader
        name="Rover"
        breedName={null}
        pickerRef={mockPickerRef}
        onImageSelected={mockOnImageSelected}
      />,
    );

    expect(ProfileHeader).toHaveBeenLastCalledWith(
      expect.objectContaining({subtitle: 'Unknown Breed'}),
      undefined,
    );
  });

  // --- 4. Fallback Initial Logic ---
  it('generates the correct uppercase fallback initial from the name', () => {
    // Uppercase Source
    render(
      <CompanionProfileHeader
        name="Charlie"
        pickerRef={mockPickerRef}
        onImageSelected={mockOnImageSelected}
      />,
    );
    expect(ProfileHeader).toHaveBeenLastCalledWith(
      expect.objectContaining({fallbackInitial: 'C'}),
      undefined,
    );

    // Lowercase Source
    render(
      <CompanionProfileHeader
        name="spot"
        pickerRef={mockPickerRef}
        onImageSelected={mockOnImageSelected}
      />,
    );
    expect(ProfileHeader).toHaveBeenLastCalledWith(
      expect.objectContaining({fallbackInitial: 'S'}),
      undefined,
    );

    // Empty Source (Safety Check for optional chaining)
    render(
      <CompanionProfileHeader
        name=""
        pickerRef={mockPickerRef}
        onImageSelected={mockOnImageSelected}
      />,
    );
    // name?.charAt(0) on "" returns ""
    expect(ProfileHeader).toHaveBeenLastCalledWith(
      expect.objectContaining({fallbackInitial: ''}),
      undefined,
    );
  });
});
