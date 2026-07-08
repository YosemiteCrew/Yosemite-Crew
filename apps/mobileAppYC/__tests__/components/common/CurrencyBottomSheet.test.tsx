import React from 'react';
import {render, act} from '@testing-library/react-native';
import type {CurrencyBottomSheetRef} from '@/shared/components/common/CurrencyBottomSheet/CurrencyBottomSheet';
import type {SelectItem} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';

// --- Mocks ---

// 1. Mock JSON data sources
const mockCountries = [
  {code: 'US', flag: '🇺🇸'},
  {code: 'EU', flag: '🇪🇺'},
];

const mockCurrencies = [
  {code: 'EUR', name: 'Euro', symbol: '€', countryCode: 'EU'},
  {code: 'USD', name: 'US Dollar', symbol: '$', countryCode: 'US'},
  {code: 'JPY', name: 'Japanese Yen', symbol: '¥', countryCode: 'JP'},
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
      GenericSelectBottomSheet: ReactActual.forwardRef(
        (props: any, ref: any) => {
          ReactActual.useImperativeHandle(ref, () => ({
            open: mockOpen,
            close: mockClose,
          }));
          mockSheetOnSave = props.onSave;
          mockGenericSheet(props);
          return <RNView testID="mock-generic-sheet" />;
        },
      ),
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
  {id: 'EUR', label: '🇪🇺 Euro (€)', code: 'EUR', symbol: '€', flag: '🇪🇺'},
  {id: 'USD', label: '🇺🇸 US Dollar ($)', code: 'USD', symbol: '$', flag: '🇺🇸'},
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
        selectedItem: expectedCurrencyOptions[1], // The full USD object
      }),
    );
  });

  it('falls back to USD if currency code is not found', () => {
    render(
      <CurrencyBottomSheet selectedCurrency="INVALID" onSave={mockOnSave} />,
    );

    expect(mockGenericSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: expectedCurrencyOptions[1],
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
      mockSheetOnSave(expectedCurrencyOptions[0]);
    });

    expect(mockOnSave).toHaveBeenCalledWith('EUR');
  });

  it('does not call onSave when sheet returns null', () => {
    render(<CurrencyBottomSheet selectedCurrency="USD" onSave={mockOnSave} />);

    act(() => {
      mockSheetOnSave(null);
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('falls back to the default flag when the currency countryCode has no matching country', () => {
    // mockCurrencies is the same array reference the component captured at
    // import time, so mutating an entry in place changes what it sees on
    // the next render without needing to reset/re-require modules.
    const originalCountryCode = mockCurrencies[0].countryCode;
    mockCurrencies[0].countryCode = 'ZZ';

    try {
      render(
        <CurrencyBottomSheet selectedCurrency="USD" onSave={mockOnSave} />,
      );

      expect(mockGenericSheet).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({code: 'EUR', flag: '🇺🇸'}),
          ]),
        }),
      );
    } finally {
      mockCurrencies[0].countryCode = originalCountryCode;
    }
  });

  it('falls back to the first option when neither the selected currency nor USD is present', () => {
    const originalUsdCode = mockCurrencies[1].code;
    mockCurrencies[1].code = 'GBP';

    try {
      render(
        <CurrencyBottomSheet selectedCurrency="INVALID" onSave={mockOnSave} />,
      );

      expect(mockGenericSheet).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedItem: expect.objectContaining({code: 'EUR'}),
        }),
      );
    } finally {
      mockCurrencies[1].code = originalUsdCode;
    }
  });

  it('falls back to null when there are no currency options at all', () => {
    const originalEurCode = mockCurrencies[0].code;
    const originalUsdCode = mockCurrencies[1].code;
    mockCurrencies[0].code = 'GBP';
    mockCurrencies[1].code = 'JPY';

    try {
      render(
        <CurrencyBottomSheet selectedCurrency="INVALID" onSave={mockOnSave} />,
      );

      expect(mockGenericSheet).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedItem: null,
        }),
      );
    } finally {
      mockCurrencies[0].code = originalEurCode;
      mockCurrencies[1].code = originalUsdCode;
    }
  });
});
