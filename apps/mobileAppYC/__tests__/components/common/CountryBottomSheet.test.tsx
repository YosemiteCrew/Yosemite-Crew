import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {
  CountryBottomSheet,
  type CountryBottomSheetRef,
} from '@/shared/components/common/CountryBottomSheet/CountryBottomSheet';
import type {SelectItem} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet.tsx';


const mockGenericSelectBottomSheet = jest.fn();

const mockOpen = jest.fn();
const mockClose = jest.fn();

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

        mockGenericSelectBottomSheet(props);

        return (
          <RNView
            testID="mock-generic-bottom-sheet"
            save={(item: any) => props.onSave(item)}
          />
        );
      }),
    };
  },
);


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
        snapPoints: ['95%', '98%'],
      }),
    );
  });

  it('correctly maps selectedCountry to selectedItem', () => {
    render(
      <CountryBottomSheet
        countries={mockCountries}
        selectedCountry={mockCountries[0]}
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
    const selectedItem = expectedCountryItems[1];

    act(() => {
      fireEvent(childSheet, 'save', selectedItem);
    });

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
