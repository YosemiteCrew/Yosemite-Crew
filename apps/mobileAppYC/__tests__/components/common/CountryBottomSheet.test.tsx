import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {
  CountryBottomSheet,
  type CountryBottomSheetRef,
} from '@/shared/components/common/CountryBottomSheet/CountryBottomSheet';
import type {SelectItem} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet.tsx';

// --- Mocks ---

// Spy on the props passed to the child component
const mockGenericSelectBottomSheet = jest.fn();

// Mock functions for the internal BottomSheet ref
const mockOpen = jest.fn();
const mockClose = jest.fn();

jest.mock(
  '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet',
  () => {
    const React = require('react');
    const {View} = require('react-native');

    return {
      GenericSelectBottomSheet: React.forwardRef((props: any, ref: any) => {
        // Expose mock methods for useImperativeHandle
        React.useImperativeHandle(ref, () => ({
          open: mockOpen,
          close: mockClose,
        }));

        // Call our spy function with the received props
        mockGenericSelectBottomSheet(props);

        // Render a placeholder we can interact with
        return (
          <View
            testID="mock-generic-bottom-sheet"
            // Helper to simulate the onSave prop being called
            save={(item: any) => props.onSave(item)}
          />
        );
      }),
    };
  },
);

// --- Test Setup ---

const mockCountries = [
  {name: 'United States', code: 'US', flag: '🇺🇸', dial_code: '+1'},
  {name: 'India', code: 'IN', flag: '🇮🇳', dial_code: '+91'},
];

const expectedCountryItems: SelectItem[] = [
  {
    id: 'US',
    label: '🇺🇸 United States',
    name: 'United States',
    code: 'US',
    flag: '🇺🇸',
    dial_code: '+1',
  },
  {
    id: 'IN',
    label: '🇮🇳 India',
    name: 'India',
    code: 'IN',
    flag: '🇮🇳',
    dial_code: '+91',
  },
];

describe('CountryBottomSheet', () => {
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes static props and transformed items to GenericSelectBottomSheet', () => {
    render(
      <CountryBottomSheet
        countries={mockCountries}
        selectedCountry={null}
        onSave={mockOnSave}
      />,
    );

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Select Country',
        items: expectedCountryItems,
        searchPlaceholder: 'Search country name',
        emptyMessage: 'No results found',
        mode: 'select',
        snapPoints: ['65%', '75%'],
      }),
    );
  });

  it('correctly maps selectedCountry to selectedItem', () => {
    render(
      <CountryBottomSheet
        countries={mockCountries}
        selectedCountry={mockCountries[0]} // Select 'United States'
        onSave={mockOnSave}
      />,
    );

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: expectedCountryItems[0],
      }),
    );
  });

  it('passes selectedItem as null if selectedCountry is null', () => {
    render(
      <CountryBottomSheet
        countries={mockCountries}
        selectedCountry={null}
        onSave={mockOnSave}
      />,
    );

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: null,
      }),
    );
  });

  it('calls onSave with the full Country object when an item is saved', () => {
    const {getByTestId} = render(
      <CountryBottomSheet
        countries={mockCountries}
        selectedCountry={null}
        onSave={mockOnSave}
      />,
    );

    const childSheet = getByTestId('mock-generic-bottom-sheet');
    const selectedItem = expectedCountryItems[1]; // 'India' as a SelectItem

    act(() => {
      fireEvent(childSheet, 'save', selectedItem);
    });

    // Expect the parent onSave to be called with the *original* Country object
    expect(mockOnSave).toHaveBeenCalledWith(mockCountries[1]);
  });

  it('calls onSave with null when null is saved', () => {
    const {getByTestId} = render(
      <CountryBottomSheet
        countries={mockCountries}
        selectedCountry={mockCountries[0]}
        onSave={mockOnSave}
      />,
    );

    const childSheet = getByTestId('mock-generic-bottom-sheet');

    act(() => {
      fireEvent(childSheet, 'save', null);
    });

    expect(mockOnSave).toHaveBeenCalledWith(null);
  });

  it('calls onSave with null if saved item code is not found', () => {
    const {getByTestId} = render(
      <CountryBottomSheet
        countries={mockCountries}
        selectedCountry={null}
        onSave={mockOnSave}
      />,
    );

    const childSheet = getByTestId('mock-generic-bottom-sheet');
    const invalidItem = {id: 'XX', label: 'Invalid'};

    act(() => {
      fireEvent(childSheet, 'save', invalidItem);
    });

    // The component logic should find no match and return null
    expect(mockOnSave).toHaveBeenCalledWith(null);
  });

  it('exposes an open method via its ref', () => {
    const ref = React.createRef<CountryBottomSheetRef>();
    render(
      <CountryBottomSheet
        countries={[]}
        selectedCountry={null}
        onSave={mockOnSave}
        ref={ref}
      />,
    );

    act(() => {
      ref.current?.open();
    });
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it('exposes a close method via its ref', () => {
    const ref = React.createRef<CountryBottomSheetRef>();
    render(
      <CountryBottomSheet
        countries={[]}
        selectedCountry={null}
        onSave={mockOnSave}
        ref={ref}
      />,
    );

    act(() => {
      ref.current?.close();
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
