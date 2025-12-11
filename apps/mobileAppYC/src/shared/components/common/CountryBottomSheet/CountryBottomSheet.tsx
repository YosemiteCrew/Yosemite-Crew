// src/components/common/CountryBottomSheet/CountryBottomSheet.tsx
import React, { forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { GenericSelectBottomSheet, type SelectItem } from '../GenericSelectBottomSheet/GenericSelectBottomSheet';

interface Country {
  name: string;
  code: string;
  flag: string;
  dial_code: string;
}

export interface CountryBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface CountryBottomSheetProps {
  countries: Country[];
  selectedCountry: Country | null;
  onSave: (country: Country | null) => void;
}

export const CountryBottomSheet = forwardRef<
  CountryBottomSheetRef,
  CountryBottomSheetProps
>(({ countries, selectedCountry, onSave }, ref) => {
  const bottomSheetRef = useRef<any>(null);

  const countryItems: SelectItem[] = useMemo(() =>
    countries.map(country => ({
      id: country.code,
      label: `${country.flag} ${country.name}`,
      ...country,
    })), [countries]
  );

  const selectedItem = selectedCountry ? {
    id: selectedCountry.code,
    label: `${selectedCountry.flag} ${selectedCountry.name}`,
    ...selectedCountry,
  } : null;

  useImperativeHandle(ref, () => ({
    open: () => {
      bottomSheetRef.current?.open();
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const handleSave = (item: SelectItem | null) => {
    const country = item ? countries.find(c => c.code === item.id) || null : null;
    onSave(country);
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="Select Country"
      items={countryItems}
      selectedItem={selectedItem}
      onSave={handleSave}
      searchPlaceholder="Search country name"
      emptyMessage="No results found"
      mode='select'
            snapPoints={['95%','98%']}
    />
  );
});

CountryBottomSheet.displayName = 'CountryBottomSheet';
