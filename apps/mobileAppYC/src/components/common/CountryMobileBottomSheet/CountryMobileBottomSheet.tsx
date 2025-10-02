// src/components/common/CountryMobileBottomSheet/CountryMobileBottomSheet.tsx
import React, {useState, forwardRef, useImperativeHandle, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
} from 'react-native';
import CustomBottomSheet from '../BottomSheet/BottomSheet';
import type {BottomSheetRef} from '../BottomSheet/BottomSheet';
import {Input} from '../Input/Input';
import LiquidGlassButton from '../LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '../../../hooks';
import {Images} from '../../../assets/images';

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
>(({countries, selectedCountry, mobileNumber, onSave}, ref) => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<BottomSheetRef>(null);

  const [tempCountry, setTempCountry] = useState<Country>(selectedCountry);
  const [tempMobile, setTempMobile] = useState<string>(mobileNumber);
  const [searchQuery, setSearchQuery] = useState('');

  const styles = createStyles(theme);

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        No results found
      </Text>
    </View>
  );

  useImperativeHandle(ref, () => ({
    open: () => {
      setTempCountry(selectedCountry);
      setTempMobile(mobileNumber);
      setSearchQuery('');
      bottomSheetRef.current?.snapToIndex(0);
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const filteredCountries = countries.filter(
    country =>
      country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      country.dial_code.includes(searchQuery),
  );

  const handleSave = () => {
    onSave(tempCountry, tempMobile);
    bottomSheetRef.current?.close();
  };

  const handleCancel = () => {
    setTempCountry(selectedCountry);
    setTempMobile(mobileNumber);
    setSearchQuery('');
    bottomSheetRef.current?.close();
  };

  const renderCountryItem = ({item}: {item: Country}) => {
    const isSelected = item.code === tempCountry.code;

    return (
      <TouchableOpacity
        style={[
          styles.countryItem,
          isSelected && styles.countryItemSelected,
        ]}
        onPress={() => setTempCountry(item)}
        activeOpacity={0.7}>
        <Text style={styles.flag}>{item.flag}</Text>
        <Text style={styles.countryName}>
          {item.name}
        </Text>
        <Text style={styles.dialCode}>
          {item.dial_code}
        </Text>
        {isSelected && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <CustomBottomSheet
      ref={bottomSheetRef}
      snapPoints={['85%']}
      initialIndex={-1}
      enablePanDownToClose={true}
      enableDynamicSizing={false}
      enableContentPanningGesture={false}
      enableBackdrop={true}
      backdropOpacity={0.5}
      backdropDisappearsOnIndex={-1}
      backdropPressBehavior="close"
      contentType="view"
      enableHandlePanningGesture={true}
      enableOverDrag={true}
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.bottomSheetHandle}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Phone number
          </Text>
          <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
            <Image
              source={Images.crossIcon}
              style={styles.closeIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Input Row */}
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

        {/* Search */}
        <View style={styles.searchContainer}>
          <Input
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search country name"
            icon={
              <Image
                source={Images.searchIcon}
                style={styles.searchIconImage}
              />
            }
            containerStyle={styles.searchInputContainer}
          />
        </View>

        {/* Country List - Fixed Height */}
        <View style={styles.listWrapper}>
          <FlatList
            data={filteredCountries}
            keyExtractor={item => item.code}
            renderItem={renderCountryItem}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.listContent}
            nestedScrollEnabled={true}
            ListEmptyComponent={renderEmptyList}
          />
        </View>

        {/* Buttons - Always Visible */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            activeOpacity={0.7}>
            <Text style={styles.cancelText}>
              Cancel
            </Text>
          </TouchableOpacity>

          <LiquidGlassButton
            title="Save"
            onPress={handleSave}
            style={styles.saveButton}
            textStyle={styles.saveButtonText}
            tintColor={theme.colors.secondary}
            height={56}
            borderRadius={16}
          />
        </View>
      </View>
    </CustomBottomSheet>
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
      backgroundColor: 'transparent',
    },
    cancelButton: {
      flex: 1,
      height: 56,
      borderWidth: 2,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.md, // 12
      justifyContent: 'center',
      alignItems: 'center',
    },
    cancelText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.text,
    },
    saveButton: {
      flex: 1,
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