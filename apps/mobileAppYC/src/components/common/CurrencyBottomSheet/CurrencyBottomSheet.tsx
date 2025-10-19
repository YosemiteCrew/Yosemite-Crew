import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  GenericSelectBottomSheet,
  type GenericSelectBottomSheetRef,
  type SelectItem,
} from '@/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import countryList from '@/utils/countryList.json';
import currencyList from '@/utils/currencyList.json';

export interface CurrencyBottomSheetRef {
  open: () => void;
  close: () => void;
}

export interface CurrencyBottomSheetProps {
  selectedCurrency: string;
  onSave: (currency: string) => void;
}

type CurrencyOption = SelectItem & {
  code: string;
  symbol: string;
  flag: string;
};

const COUNTRIES: Array<{code: string; flag: string}> = countryList as Array<{
  code: string;
  flag: string;
}>;
const CURRENCIES: Array<{
  code: string;
  name: string;
  symbol: string;
  countryCode: string;
}> = currencyList as Array<{
  code: string;
  name: string;
  symbol: string;
  countryCode: string;
}>;

const SPECIAL_FLAGS: Record<string, string> = {
  EU: '🇪🇺',
};

const resolveFlag = (countryCode: string) => {
  if (SPECIAL_FLAGS[countryCode]) {
    return SPECIAL_FLAGS[countryCode];
  }
  const country = COUNTRIES.find(c => c.code === countryCode);
  return country?.flag ?? '🇺🇸';
};

const mapToOptions = (): CurrencyOption[] =>
  CURRENCIES.map(currency => {
    const flag = resolveFlag(currency.countryCode);
    return {
      id: currency.code,
      label: `${flag} ${currency.name} (${currency.symbol})`,
      code: currency.code,
      symbol: currency.symbol,
      flag,
    };
  });

export const CurrencyBottomSheet = forwardRef<
  CurrencyBottomSheetRef,
  CurrencyBottomSheetProps
>(({selectedCurrency, onSave}, ref) => {
  const sheetRef = useRef<GenericSelectBottomSheetRef>(null);

  const currencyOptions = useMemo(() => mapToOptions(), []);

  const selectedItem = useMemo(
    () => currencyOptions.find(option => option.code === selectedCurrency) ?? null,
    [currencyOptions, selectedCurrency],
  );

  useImperativeHandle(ref, () => ({
    open: () => {
      sheetRef.current?.open();
    },
    close: () => {
      sheetRef.current?.close();
    },
  }));

  const handleSave = (item: SelectItem | null) => {
    onSave(item?.id ?? selectedCurrency);
  };

  return (
    <GenericSelectBottomSheet
      ref={sheetRef}
      title="Currency"
      items={currencyOptions}
      selectedItem={selectedItem}
      onSave={handleSave}
      searchPlaceholder="Search currency"
      emptyMessage="No results found"
      snapPoints={['75%', '90%']}
    />
  );
});

CurrencyBottomSheet.displayName = 'CurrencyBottomSheet';
