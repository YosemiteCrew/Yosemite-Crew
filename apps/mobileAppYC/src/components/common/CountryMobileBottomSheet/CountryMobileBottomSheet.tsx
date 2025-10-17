// src/components/common/CountryMobileBottomSheet/CountryMobileBottomSheet.tsx
import React, { useState, forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { GenericSelectBottomSheet, type SelectItem } from '../GenericSelectBottomSheet/GenericSelectBottomSheet';
import { Input } from '../Input/Input';
import { useTheme } from '../../../hooks';

interface Country {
  name: string;
  flag: string;
  code: string;
  dial_code: string;
}

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
>(({ countries, selectedCountry, mobileNumber, onSave }, ref) => {
  const { theme } = useTheme();
  const bottomSheetRef = useRef<any>(null);

  const [tempCountry, setTempCountry] = useState<Country>(selectedCountry);
  const [tempMobile, setTempMobile] = useState<string>(mobileNumber);

  const styles = createStyles(theme);

  const countryItems: SelectItem[] = useMemo(() =>
    countries.map(country => ({
      id: country.code,
      label: `${country.flag} ${country.name} ${country.dial_code}`,
      ...country,
    })), [countries]
  );

  const selectedItem = {
    id: tempCountry.code,
    label: `${tempCountry.flag} ${tempCountry.name} ${tempCountry.dial_code}`,
    ...tempCountry,
  };

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

  const handleSave = (item: SelectItem | null) => {
    const country = item ? countries.find(c => c.code === item.id) || selectedCountry : selectedCountry;
    onSave(country, tempMobile);
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
          maxLength={10}
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
      searchPlaceholder="Search country name"
      emptyMessage="No results found"
      customContent={customContent}
    />
  );
});

CountryMobileBottomSheet.displayName = 'CountryMobileBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing['5'], // 20
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing['4'], // 16
      position: 'relative',
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.text,
    },
    closeButton: {
      position: 'absolute',
      right: 0,
      padding: theme.spacing['2'], // 8
    },
    closeIcon: {
      width: theme.spacing['6'], // 24
      height: theme.spacing['6'], // 24
    },
    inputRow: {
      flexDirection: 'row',
      gap: theme.spacing['3'], // 12
      marginBottom: theme.spacing['4'], // 16
    },
    countryCodeWrapper: {
      width: 110,
    },
    countryCodeContainer: {
      flex: 1,
    },
    countryCodeInput: {
      fontSize: 16,
    },
    mobileInputWrapper: {
      flex: 1,
    },
    searchContainer: {
      marginBottom: theme.spacing['4'], // 16
    },
    searchInputContainer: {
      marginBottom: 0,
    },
    searchIconImage: {
      width: theme.spacing['5'], // 20
      height: theme.spacing['5'], // 20
      tintColor: theme.colors.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing['10'], // 40
    },
    emptyText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    listWrapper: {
      flex: 1,
      height: 400,
      marginBottom: theme.spacing['2'], // 8
    },
    listContent: {
      paddingBottom: theme.spacing['2'], // 8
    },
    countryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: theme.spacing['3'], // 12
      borderRadius: theme.borderRadius.base, // 8
      marginBottom: theme.spacing['1'], // 4
    },
    countryItemSelected: {
      backgroundColor: theme.colors.surface,
    },
    flag: {
      fontSize: theme.spacing['6'], // 24
      marginRight: theme.spacing['3'], // 12
    },
    countryName: {
      flex: 1,
      ...theme.typography.body,
      color: theme.colors.text,
    },
    dialCode: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      marginRight: theme.spacing['2'], // 8
    },
    checkmark: {
      width: theme.spacing['5'], // 20
      height: theme.spacing['5'], // 20
      borderRadius: theme.spacing['5'] / 2, // 10
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkmarkText: {
      color: theme.colors.white,
      fontSize: theme.spacing['3'], // 12
      fontWeight: 'bold',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: theme.spacing['3'], // 12
      paddingVertical: theme.spacing['4'], // 16
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.white,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: theme.colors.white,
    },
    cancelButtonText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.text,
    },
    saveButton: {
      flex: 1,
      backgroundColor: theme.colors.secondary,
    },
    saveButtonAndroid: {
      backgroundColor: theme.colors.secondary,
    },
    saveButtonText: {
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
    },
    // Bottom Sheet Styles
    bottomSheetBackground: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
    },
    bottomSheetHandle: {
      backgroundColor: theme.colors.black,
      width: 80,
      height: 6,
      opacity: 0.2,
    },
  });
