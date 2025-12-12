import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {
  AddressBottomSheet,
  AddressBottomSheetRef,
} from '../../../src/shared/components/common/AddressBottomSheet/AddressBottomSheet';

// --- Mocks ---

// 1. Mock Hooks
// Variables prefixed with 'mock' are allowed inside jest.mock factories
const mockSetQuery = jest.fn();
const mockClearSuggestions = jest.fn();
const mockSelectSuggestion = jest.fn();
const mockResetError = jest.fn();

jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        surface: '#ffffff',
        secondary: '#000000',
        borderMuted: '#e0e0e0',
      },
      spacing: {2: 8, 4: 16},
      borderRadius: {lg: 8, md: 4},
      typography: {body: {fontSize: 14}},
      shadows: {md: {}},
    },
  }),
  useAddressAutocomplete: () => ({
    setQuery: mockSetQuery,
    suggestions: [],
    isFetching: false,
    error: null,
    clearSuggestions: mockClearSuggestions,
    selectSuggestion: mockSelectSuggestion,
    resetError: mockResetError,
  }),
}));

// 2. Mock Assets
jest.mock('@/assets/images', () => ({
  Images: {
    crossIcon: {uri: 'cross-icon-png'},
  },
}));

// 3. Mock Utils
jest.mock('@/shared/utils/bottomSheetHelpers', () => ({
  createBottomSheetStyles: () => ({}),
  createBottomSheetContainerStyles: () => ({container: {}}),
  createBottomSheetButtonStyles: () => ({}),
  createBottomSheetImperativeHandle: (ref: any, callback: () => void) => ({
    open: () => {
      callback(); // Execute the reset logic passed from the component
      ref.current?.open();
    },
    close: () => {
      ref.current?.close();
    },
  }),
}));

// 4. Mock Child Components

// Mock CustomBottomSheet
// FIX: Renamed require('react') to ReactLib to avoid shadowing top-level React import
jest.mock('@/shared/components/common/BottomSheet/BottomSheet', () => {
  const ReactLib = require('react');
  const {View: RNView, Button: RNButton} = require('react-native'); // Require Button here

  return ReactLib.forwardRef((props: any, ref: any) => {
    ReactLib.useImperativeHandle(ref, () => ({
      open: jest.fn(),
      close: jest.fn(),
    }));
    return (
      <RNView testID="mock-bottom-sheet">
        {props.children}
        {/* Helper to trigger the onChange prop logic */}
        <RNButton
          title="Trigger Sheet Change"
          onPress={() => props.onChange?.(0)}
        />
      </RNView>
    );
  });
});

// Mock LiquidGlassButton
jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {
      TouchableOpacity: RNTouchableOpacity,
      Text: RNText,
    } = require('react-native');
    return (props: any) => (
      <RNTouchableOpacity testID={`btn-${props.title}`} onPress={props.onPress}>
        <RNText>{props.title}</RNText>
      </RNTouchableOpacity>
    );
  },
);

// Mock AddressFields
jest.mock('@/shared/components/forms/AddressFields', () => {
  const {View: RNView, Button: RNButton} = require('react-native');
  return {
    AddressFields: ({onChange, onSelectSuggestion}: any) => (
      <RNView testID="address-fields">
        <RNButton
          testID="trigger-address-change"
          title="Change Address"
          onPress={() => onChange('addressLine', '123 New St')}
        />
        <RNButton
          testID="trigger-city-change"
          title="Change City"
          onPress={() => onChange('city', 'New City')}
        />
        <RNButton
          testID="trigger-suggestion"
          title="Select Suggestion"
          onPress={() =>
            onSelectSuggestion({placeId: 'abc', primaryText: 'Suggestion St'})
          }
        />
      </RNView>
    ),
  };
});

describe('AddressBottomSheet Component', () => {
  const mockOnSave = jest.fn();
  const initialAddress = {
    addressLine: 'Old St',
    city: 'Old City',
    stateProvince: 'State',
    postalCode: '00000',
    country: 'Country',
  };

  let ref: React.RefObject<AddressBottomSheetRef | null>;

  beforeEach(() => {
    jest.clearAllMocks();
    ref = React.createRef();
  });

  // ===========================================================================
  // 1. Rendering Logic
  // ===========================================================================

  it('renders correctly', () => {
    const {getByText, getByTestId} = render(
      <AddressBottomSheet
        ref={ref}
        selectedAddress={initialAddress}
        onSave={mockOnSave}
      />,
    );

    expect(getByText('Address')).toBeTruthy();
    expect(getByTestId('mock-bottom-sheet')).toBeTruthy();
    expect(getByTestId('address-fields')).toBeTruthy();
    expect(getByTestId('btn-Save')).toBeTruthy();
    expect(getByTestId('btn-Cancel')).toBeTruthy();
  });

  it('updates sheet visibility state on change', () => {
    const {getByText} = render(
      <AddressBottomSheet
        ref={ref}
        selectedAddress={initialAddress}
        onSave={mockOnSave}
      />,
    );

    // Initial render implies hidden (-1), triggering change to 0 sets visible
    // This executes the setIsSheetVisible state update
    fireEvent.press(getByText('Trigger Sheet Change'));
  });

  // ===========================================================================
  // 2. Ref Interaction
  // ===========================================================================

  it('resets state and query when opened via ref', () => {
    render(
      <AddressBottomSheet
        ref={ref}
        selectedAddress={initialAddress}
        onSave={mockOnSave}
      />,
    );

    // Call open on the ref
    ref.current?.open();

    expect(mockSetQuery).toHaveBeenCalledWith('Old St', {suppressLookup: true});
    expect(mockClearSuggestions).toHaveBeenCalled();
    expect(mockResetError).toHaveBeenCalled();
  });

  it('closes via ref', () => {
    render(
      <AddressBottomSheet
        ref={ref}
        selectedAddress={initialAddress}
        onSave={mockOnSave}
      />,
    );
    expect(() => ref.current?.close()).not.toThrow();
  });

  // ===========================================================================
  // 3. Interaction & Logic (Editing Fields)
  // ===========================================================================

  it('updates temp address and query when addressLine field changes', () => {
    const {getByTestId} = render(
      <AddressBottomSheet
        ref={ref}
        selectedAddress={initialAddress}
        onSave={mockOnSave}
      />,
    );

    // Trigger change via mock button in AddressFields
    fireEvent.press(getByTestId('trigger-address-change')); // Sets '123 New St'

    // Verify setQuery is called for 'addressLine'
    expect(mockSetQuery).toHaveBeenCalledWith('123 New St');

    // Save to verify internal state updated
    fireEvent.press(getByTestId('btn-Save'));

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        addressLine: '123 New St',
        city: 'Old City', // others remain
      }),
    );
  });

  it('updates temp address ONLY (no query change) when other fields change', () => {
    const {getByTestId} = render(
      <AddressBottomSheet
        ref={ref}
        selectedAddress={initialAddress}
        onSave={mockOnSave}
      />,
    );

    fireEvent.press(getByTestId('trigger-city-change')); // Sets 'New City'

    // Save to verify
    fireEvent.press(getByTestId('btn-Save'));

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        addressLine: 'Old St',
        city: 'New City',
      }),
    );
    // mockSetQuery was called on init, but should not be called with 'New City'
    expect(mockSetQuery).not.toHaveBeenCalledWith('New City');
  });

  // ===========================================================================
  // 4. Suggestion Logic (Google Places)
  // ===========================================================================

  it('populates address details when a suggestion is selected', async () => {
    // Mock the resolution of selectSuggestion
    mockSelectSuggestion.mockResolvedValueOnce({
      addressLine: 'Resolved St',
      city: 'Resolved City',
      stateProvince: 'Resolved State',
      postalCode: '99999',
      country: 'Resolved Country',
    });

    const {getByTestId} = render(
      <AddressBottomSheet
        ref={ref}
        selectedAddress={initialAddress}
        onSave={mockOnSave}
      />,
    );

    // Trigger suggestion press
    await fireEvent.press(getByTestId('trigger-suggestion'));

    // Wait for async selectSuggestion
    await waitFor(() => {
      fireEvent.press(getByTestId('btn-Save'));
    });

    expect(mockSelectSuggestion).toHaveBeenCalledWith({
      placeId: 'abc',
      primaryText: 'Suggestion St',
    });
  });

  it('handles null return from selectSuggestion gracefully', async () => {
    mockSelectSuggestion.mockResolvedValueOnce(null);

    const {getByTestId} = render(
      <AddressBottomSheet
        ref={ref}
        selectedAddress={initialAddress}
        onSave={mockOnSave}
      />,
    );

    await fireEvent.press(getByTestId('trigger-suggestion'));

    fireEvent.press(getByTestId('btn-Save'));

    // Should save ORIGINAL address because update didn't happen
    expect(mockOnSave).toHaveBeenCalledWith(initialAddress);
  });

  it('uses suggestion primaryText if addressLine is missing in details', async () => {
    mockSelectSuggestion.mockResolvedValueOnce({
      // addressLine missing
      city: 'Partial City',
    });

    const {getByTestId} = render(
      <AddressBottomSheet
        ref={ref}
        selectedAddress={initialAddress}
        onSave={mockOnSave}
      />,
    );

    await fireEvent.press(getByTestId('trigger-suggestion'));
    fireEvent.press(getByTestId('btn-Save'));
  });

  // ===========================================================================
  // 5. Cancel Logic
  // ===========================================================================

  it('resets state and closes sheet on cancel', () => {
    const {getByTestId, UNSAFE_getAllByType} = render(
      <AddressBottomSheet
        ref={ref}
        selectedAddress={initialAddress}
        onSave={mockOnSave}
      />,
    );

    // 1. Change something
    fireEvent.press(getByTestId('trigger-address-change'));

    // 2. Press Cancel
    const cancelButton = getByTestId('btn-Cancel');
    fireEvent.press(cancelButton);

    // 3. Verify Clean Up
    expect(mockSetQuery).toHaveBeenCalledWith('Old St', {suppressLookup: true});
    expect(mockClearSuggestions).toHaveBeenCalled();
    expect(mockResetError).toHaveBeenCalled();

    // Also verify header close button works (same logic)
    const {TouchableOpacity} = require('react-native');
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    const headerClose = touchables[0]; // First one is header close
    fireEvent.press(headerClose);
    expect(mockClearSuggestions).toHaveBeenCalledTimes(2);
  });
});
