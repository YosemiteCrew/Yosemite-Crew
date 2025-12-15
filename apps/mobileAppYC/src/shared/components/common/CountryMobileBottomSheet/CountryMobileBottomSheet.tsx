// src/components/common/CountryMobileBottomSheet/CountryMobileBottomSheet.tsx
import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {View, StyleSheet} from 'react-native';
import {
  GenericSelectBottomSheet,
  type GenericSelectBottomSheetRef,
  type SelectItem,
} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import {Input} from '@/shared/components/common/Input/Input';
import {useTheme} from '@/hooks';

type Country = {
  name: string;
  flag: string;
  code: string;
  dial_code: string;
};

export interface CountryMobileBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface CountryMobileBottomSheetProps {
  countries: Country[];
  selectedCountry: Country;
  mobileNumber: string;
  onSave: (country: Country, mobile: string) => void;
}

export const CountryMobileBottomSheet = forwardRef<
  CountryMobileBottomSheetRef,
  CountryMobileBottomSheetProps
>(({countries, selectedCountry, mobileNumber, onSave}, ref) => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<GenericSelectBottomSheetRef>(null);

  const [tempCountry, setTempCountry] = useState<Country>(selectedCountry);
  const [tempMobile, setTempMobile] = useState<string>(mobileNumber);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        inputRow: {
          flexDirection: 'row',
          gap: theme.spacing['3'],
          marginBottom: theme.spacing['4'],
        },
        countryCodeWrapper: {width: 110},
        countryCodeContainer: {flex: 1},
        countryCodeInput: {fontSize: 16},
        mobileInputWrapper: {flex: 1},
      }),
    [theme],
  );

  const countryItems: SelectItem[] = useMemo(
    () =>
      countries.map(country => ({
        id: country.code,
        label: `${country.flag} ${country.name} ${country.dial_code}`,
        ...country,
      })),
    [countries],
  );

  const selectedItem = useMemo(
    () => ({
      id: tempCountry.code,
      label: `${tempCountry.flag} ${tempCountry.name} ${tempCountry.dial_code}`,
      ...tempCountry,
    }),
    [tempCountry],
  );

  useImperativeHandle(ref, () => ({
    open: () => {
      setTempCountry(selectedCountry);
      setTempMobile(mobileNumber);
      bottomSheetRef.current?.open();
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const handleCountrySelect = (item: SelectItem | null) => {
    const match = item ? countries.find(c => c.code === item.id) : undefined;
    if (match) {
      setTempCountry(match);
    }
  };

  const handleSave = (item: SelectItem | null) => {
    const match = item ? countries.find(c => c.code === item.id) : undefined;
    onSave(match ?? selectedCountry, tempMobile);
  };

  const customContent = (
    <View style={styles.inputRow}>
      <View style={styles.countryCodeWrapper}>
        <Input
          value={`${tempCountry.flag} ${tempCountry.dial_code}`}
          editable={false}
          label="Country"
          containerStyle={styles.countryCodeContainer}
          inputStyle={styles.countryCodeInput}
        />
      </View>

      <View style={styles.mobileInputWrapper}>
        <Input
          value={tempMobile}
          onChangeText={setTempMobile}
          label="Phone number"
          keyboardType="phone-pad"
          maxLength={12}
        />
      </View>
    </View>
  );

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="Phone number"
      items={countryItems}
      selectedItem={selectedItem}
      onSave={handleSave}
      onItemSelect={handleCountrySelect}
      searchPlaceholder="Search country name"
      emptyMessage="No results found"
      customContent={customContent}
    />
  );
});

CountryMobileBottomSheet.displayName = 'CountryMobileBottomSheet';
