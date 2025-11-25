import React from 'react';
import {render, act} from '@testing-library/react-native';
import type {CurrencyBottomSheetRef} from '@/shared/components/common/CurrencyBottomSheet/CurrencyBottomSheet';
import type {SelectItem} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';

// --- Mocks ---

// 1. Mock JSON data sources
const mockCountries = [
  {code: 'US', flag: '🇺🇸'},
  {code: 'IN', flag: '🇮🇳'},
];

const mockCurrencies = [
  {code: 'INR', name: 'Indian Rupee', symbol: '₹', countryCode: 'IN'},
  {code: 'EUR', name: 'Euro', symbol: '€', countryCode: 'EU'},
  {code: 'XYZ', name: 'Test Currency', symbol: 'T', countryCode: 'XX'},
  {code: 'USD', name: 'US Dollar', symbol: '$', countryCode: 'US'},
];

// FIX: Use jest.doMock for JSON files *before* importing the component
jest.doMock('@/shared/utils/countryList.json', () => mockCountries, {
  virtual: true,
});
jest.doMock('@/shared/utils/currencyList.json', () => mockCurrencies, {
  virtual: true,
});

// 2. Mock Child Component
const mockGenericSheet = jest.fn();
const mockOpen = jest.fn();
const mockClose = jest.fn();
let mockSheetOnSave: (item: SelectItem | null) => void = () => {};

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
        mockSheetOnSave = props.onSave;
        mockGenericSheet(props);
        return <RNView testID="mock-generic-sheet" />;
      }),
    };
  },
);

// 3. Mock react-native (Minimal)
// FIX: Using a minimal mock to avoid the 'displayName' error
jest.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: any) => styles,
  },
  View: 'View',
  Text: 'Text',
}));

// --- Import Component *After* Mocks ---
// This is necessary for the doMock to work
const {
  CurrencyBottomSheet,
} = require('@/shared/components/common/CurrencyBottomSheet/CurrencyBottomSheet');

// --- Test Setup ---

const expectedCurrencyOptions = [
  {
    id: 'INR',
    label: '🇮🇳 Indian Rupee (₹)',
    code: 'INR',
    symbol: '₹',
    flag: '🇮🇳',
  },
  {id: 'EUR', label: '🇪🇺 Euro (€)', code: 'EUR', symbol: '€', flag: '🇪🇺'},
  {
    id: 'XYZ',
    label: '🇺🇸 Test Currency (T)', // Note the 'US' fallback flag
    code: 'XYZ',
    symbol: 'T',
    flag: '🇺🇸',
  },
  {
    id: 'USD',
    label: '🇺🇸 US Dollar ($)',
    code: 'USD',
    symbol: '$',
    flag: '🇺🇸',
  },
];

describe('CurrencyBottomSheet', () => {
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes static props and correctly transformed items', () => {
    render(<CurrencyBottomSheet selectedCurrency="USD" onSave={mockOnSave} />);

    expect(mockGenericSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Currency',
        searchPlaceholder: 'Search currency',
        items: expectedCurrencyOptions, // Verifies all transformation logic
      }),
    );
  });

  it('correctly finds and passes the selectedItem', () => {
    render(<CurrencyBottomSheet selectedCurrency="USD" onSave={mockOnSave} />);

    expect(mockGenericSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: expectedCurrencyOptions[3], // The full USD object
      }),
    );
  });

  it('passes null as selectedItem if currency code is not found', () => {
    render(
      <CurrencyBottomSheet selectedCurrency="INVALID" onSave={mockOnSave} />,
    );

    expect(mockGenericSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: null,
      }),
    );
  });

  it('exposes and calls open/close ref methods', () => {
    const ref = React.createRef<CurrencyBottomSheetRef>();
    render(
      <CurrencyBottomSheet
        selectedCurrency="USD"
        onSave={mockOnSave}
        ref={ref}
      />,
    );

    act(() => {
      ref.current?.open();
    });
    expect(mockOpen).toHaveBeenCalledTimes(1);

    act(() => {
      ref.current?.close();
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSave with the item ID (string) when saved', () => {
    render(<CurrencyBottomSheet selectedCurrency="USD" onSave={mockOnSave} />);

    // Simulate selecting "EUR" from the list
    act(() => {
      mockSheetOnSave(expectedCurrencyOptions[1]);
    });

    expect(mockOnSave).toHaveBeenCalledWith('EUR');
  });

  it('calls onSave with the original selectedCurrency prop if save item is null', () => {
    render(<CurrencyBottomSheet selectedCurrency="USD" onSave={mockOnSave} />);

    // Simulate dismissing the sheet
    act(() => {
      mockSheetOnSave(null);
    });

    // Verifies the fallback logic
    expect(mockOnSave).toHaveBeenCalledWith('USD');
  });
});
