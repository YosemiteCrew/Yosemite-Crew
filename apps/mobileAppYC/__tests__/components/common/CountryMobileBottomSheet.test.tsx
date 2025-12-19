import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, act} from '@testing-library/react-native';
import {
  CountryMobileBottomSheet,
  type CountryMobileBottomSheetRef,
} from '@/shared/components/common/CountryMobileBottomSheet/CountryMobileBottomSheet';
import type {SelectItem} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet.tsx';
import {useTheme} from '@/hooks';

// --- Mocks ---

// 1. Mock useTheme

jest.mock('@/hooks', () => {
  const {mockTheme: theme} = require('../setup/mockTheme');
  return {
    __esModule: true,
    useTheme: jest.fn(() => ({theme, isDark: false})),
  };
});

// 2. Mock Child Components

// Spy on GenericSelectBottomSheet
const mockGenericSheet = jest.fn();
const mockOpen = jest.fn();
const mockClose = jest.fn();
let mockSheetOnSave: (item: SelectItem | null) => void = () => {};
let mockSheetOnItemSelect: (item: SelectItem | null) => void = () => {};

jest.mock(
  '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet',
  () => {
    const ReactActual = jest.requireActual('react');
    const {View: RNView} = jest.requireActual('react-native');

    return {
      GenericSelectBottomSheet: ReactActual.forwardRef((props: any, ref: any) => {
        ReactActual.useImperativeHandle(ref, () => ({
          open: mockOpen,
          close: mockClose,
        }));
        // Store callbacks to be triggered later
        mockSheetOnSave = props.onSave;
        mockSheetOnItemSelect = props.onItemSelect;
        mockGenericSheet(props); // Spy on props

        // Render customContent so we can find the Inputs
        return (
          <RNView testID="mock-generic-bottom-sheet">
            {props.customContent}
          </RNView>
        );
      }),
    };
  },
);

// Spy on Input
const mockInput = jest.fn();

jest.mock('@/shared/components/common/Input/Input', () => {
  const {TextInput} = require('react-native');
  return {
    Input: (props: any) => {
      mockInput(props); // Spy on props
      return (
        <TextInput
          testID={`mock-input-${props.label}`}
          value={props.value}
          onChangeText={props.onChangeText}
          editable={props.editable}
        />
      );
    },
  };
});

// --- Test Setup ---

const mockCountries = [
  {name: 'United States', code: 'US', flag: '🇺🇸', dial_code: '+1'},
  {name: 'India', code: 'IN', flag: '🇮🇳', dial_code: '+91'},
];

const expectedCountryItems: SelectItem[] = [
  {
    id: 'US',
    label: '🇺🇸 United States +1',
    name: 'United States',
    code: 'US',
    flag: '🇺🇸',
    dial_code: '+1',
  },
  {
    id: 'IN',
    label: '🇮🇳 India +91',
    name: 'India',
    code: 'IN',
    flag: '🇮🇳',
    dial_code: '+91',
  },
];

describe('CountryMobileBottomSheet', () => {
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({theme: mockTheme});
  });

  it('renders with initial props and transformed items', () => {
    render(
      <CountryMobileBottomSheet
        countries={mockCountries}
        selectedCountry={mockCountries[0]}
        mobileNumber="12345"
        onSave={mockOnSave}
      />,
    );

    // 1. Check GenericSelectBottomSheet props
    expect(mockGenericSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Phone number',
        items: expectedCountryItems,
        selectedItem: expectedCountryItems[0],
      }),
    );

    // 2. Check Country Input
    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({
        value: '🇺🇸 +1',
        label: 'Country',
      }),
    );

    // 3. Check Phone Input
    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({
        value: '12345',
        label: 'Phone number',
      }),
    );
  });

  it('updates temp mobile state on text change', () => {
    const {getByTestId} = render(
      <CountryMobileBottomSheet
        countries={mockCountries}
        selectedCountry={mockCountries[0]}
        mobileNumber="12345"
        onSave={mockOnSave}
      />,
    );

    const phoneInput = getByTestId('mock-input-Phone number');
    act(() => {
      fireEvent.changeText(phoneInput, '99999');
    });

    expect(mockInput).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: '99999',
      }),
    );
  });

  it('updates temp country state on item select', () => {
    render(
      <CountryMobileBottomSheet
        countries={mockCountries}
        selectedCountry={mockCountries[0]}
        mobileNumber="12345"
        onSave={mockOnSave}
      />,
    );

    act(() => {
      mockSheetOnItemSelect(expectedCountryItems[1]); // Select India
    });

    // The 3rd call (index 2) is the Country input after the update
    expect(mockInput.mock.calls[2][0]).toEqual(
      expect.objectContaining({
        value: '🇮🇳 +91',
      }),
    );
  });

  it('does not update temp country state if item is not found', () => {
    render(
      <CountryMobileBottomSheet
        countries={mockCountries}
        selectedCountry={mockCountries[0]}
        mobileNumber="12345"
        onSave={mockOnSave}
      />,
    );

    expect(mockInput.mock.calls[0][0].value).toBe('🇺🇸 +1'); // Initial

    act(() => {
      mockSheetOnItemSelect(null);
    });
    act(() => {
      mockSheetOnItemSelect({id: 'XX', label: 'Invalid'});
    });

    // Find all calls to the "Country" input
    const countryInputCalls = mockInput.mock.calls.filter(
      call => call[0].label === 'Country',
    );
    // Get the last one
    const lastCountryCall = countryInputCalls[countryInputCalls.length - 1];
    expect(lastCountryCall[0].value).toBe('🇺🇸 +1'); // Should not have changed
  });

  it('calls onSave with the temporary state', () => {
    const {getByTestId} = render(
      <CountryMobileBottomSheet
        countries={mockCountries}
        selectedCountry={mockCountries[0]}
        mobileNumber="12345"
        onSave={mockOnSave}
      />,
    );

    act(() => {
      fireEvent.changeText(getByTestId('mock-input-Phone number'), '99999');
    });
    act(() => {
      mockSheetOnItemSelect(expectedCountryItems[1]); // Select India
    });
    act(() => {
      mockSheetOnSave(expectedCountryItems[1]); // Save with India
    });

    expect(mockOnSave).toHaveBeenCalledWith(mockCountries[1], '99999');
  });

  it('calls onSave with fallback country if item is null', () => {
    render(
      <CountryMobileBottomSheet
        countries={mockCountries}
        selectedCountry={mockCountries[0]} // Original is US
        mobileNumber="12345"
        onSave={mockOnSave}
      />,
    );

    act(() => {
      mockSheetOnSave(null);
    });

    expect(mockOnSave).toHaveBeenCalledWith(mockCountries[0], '12345');
  });

  // NEW TEST FOR 100% COVERAGE (lines 84-86)
  it('calls onSave with original country if saved item is invalid', () => {
    render(
      <CountryMobileBottomSheet
        countries={mockCountries}
        selectedCountry={mockCountries[0]} // Original is US
        mobileNumber="12345"
        onSave={mockOnSave}
      />,
    );

    act(() => {
      mockSheetOnSave({id: 'XX', label: 'Invalid'});
    });

    // match will be undefined, so it falls back to selectedCountry
    expect(mockOnSave).toHaveBeenCalledWith(mockCountries[0], '12345');
  });

  it('ref.open() resets state and opens sheet', () => {
    const ref = React.createRef<CountryMobileBottomSheetRef>();
    const {getByTestId} = render(
      <CountryMobileBottomSheet
        countries={mockCountries}
        selectedCountry={mockCountries[0]} // US, 12345
        mobileNumber="12345"
        onSave={mockOnSave}
        ref={ref}
      />,
    );

    // 1. "Dirty" the state
    act(() => {
      fireEvent.changeText(getByTestId('mock-input-Phone number'), '99999');
    });
    act(() => {
      mockSheetOnItemSelect(expectedCountryItems[1]); // Select India
    });

    // 2. Check that state is dirty
    // FIX: mock.calls[4] is Country, mock.calls[5] is Phone after state updates
    expect(mockInput.mock.calls[4][0].value).toBe('🇮🇳 +91'); // Country input
    expect(mockInput.mock.calls[5][0].value).toBe('99999'); // Phone input

    // 3. Call open()
    act(() => {
      ref.current?.open();
    });

    // 4. Verify state is reset to props
    // After open(), new calls are [6] (Country) and [7] (Phone)
    expect(mockInput.mock.calls[6][0].value).toBe('🇺🇸 +1'); // Country reset
    expect(mockInput.mock.calls[7][0].value).toBe('12345'); // Phone reset
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it('ref.close() closes the sheet', () => {
    const ref = React.createRef<CountryMobileBottomSheetRef>();
    render(
      <CountryMobileBottomSheet
        countries={mockCountries}
        selectedCountry={mockCountries[0]}
        mobileNumber="12345"
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
