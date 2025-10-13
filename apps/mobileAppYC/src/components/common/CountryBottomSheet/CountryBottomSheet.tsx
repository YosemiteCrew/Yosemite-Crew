// src/components/common/CountryBottomSheet/CountryBottomSheet.tsx
import React, {useState, forwardRef, useImperativeHandle, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Platform,
} from 'react-native';
import CustomBottomSheet from '../BottomSheet/BottomSheet';
import type {BottomSheetRef} from '../BottomSheet/BottomSheet';
import {Input} from '../Input/Input';
import LiquidGlassButton from '../LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '../../../hooks';
import {Images} from '../../../assets/images';

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
>(({countries, selectedCountry, onSave}, ref) => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<BottomSheetRef>(null);

  const [tempCountry, setTempCountry] = useState<Country | null>(
    selectedCountry,
  );
  const [searchQuery, setSearchQuery] = useState('');

  const styles = createStyles(theme);

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No results found</Text>
    </View>
  );

  useImperativeHandle(ref, () => ({
    open: () => {
      setTempCountry(selectedCountry);
      setSearchQuery('');
      bottomSheetRef.current?.snapToIndex(0);
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSave = () => {
    onSave(tempCountry);
    bottomSheetRef.current?.close();
  };

  const handleCancel = () => {
    setTempCountry(selectedCountry);
    setSearchQuery('');
    bottomSheetRef.current?.close();
  };

  const renderCountryItem = ({item}: {item: Country}) => {
    const isSelected = tempCountry?.code === item.code;

    return (
      <TouchableOpacity
        style={[styles.countryItem, isSelected && styles.countryItemSelected]}
        onPress={() => setTempCountry(item)}
        activeOpacity={0.7}>
        <Text style={styles.flag}>{item.flag}</Text>
        <Text style={styles.countryName}>{item.name}</Text>
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
      snapPoints={['83%', '95%']}
      initialIndex={-1}
      enablePanDownToClose={true}
      enableDynamicSizing={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture={true}
      enableOverDrag={true}
      enableBackdrop={true}
      backdropOpacity={0.5}
      backdropDisappearsOnIndex={-1}
      backdropPressBehavior="close"
      contentType="view"
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.bottomSheetHandle}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Select Country</Text>
          <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
            <Image
              source={Images.crossIcon}
              style={styles.closeIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
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

        {/* Country List */}
        <View style={styles.listWrapper}>
          <FlatList
            data={filteredCountries}
            keyExtractor={item => item.code}
            renderItem={renderCountryItem}
            showsVerticalScrollIndicator
            contentContainerStyle={styles.listContent}
            nestedScrollEnabled
            ListEmptyComponent={renderEmptyList}
          />
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title="Cancel"
            onPress={handleCancel}
            style={styles.cancelButton}
            textStyle={styles.cancelButtonText}
            tintColor="#FFFFFF"
            shadowIntensity="light"
            forceBorder
            borderColor="rgba(0, 0, 0, 0.12)"
            height={56}
            borderRadius={16}
          />

          <LiquidGlassButton
            title="Save"
            onPress={handleSave}
            style={StyleSheet.flatten([
              styles.saveButton,
              Platform.OS === 'android' ? styles.saveButtonAndroid : null,
            ])}
            textStyle={styles.saveButtonText}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            forceBorder
            borderColor="rgba(255, 255, 255, 0.35)"
            height={56}
            borderRadius={16}
          />
        </View>
      </View>
    </CustomBottomSheet>
  );
});

CountryBottomSheet.displayName = 'CountryBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing['5'],
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing['4'],
      position: 'relative',
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.text,
    },
    closeButton: {
      position: 'absolute',
      right: 0,
      padding: theme.spacing['2'],
    },
    closeIcon: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
    },
    searchContainer: {
      marginBottom: theme.spacing['4'],
    },
    searchInputContainer: {
      marginBottom: 0,
    },
    searchIconImage: {
      width: theme.spacing['5'],
      height: theme.spacing['5'],
      tintColor: theme.colors.textSecondary,
    },
    listWrapper: {
      flex: 1,
      height: 400,
      marginBottom: theme.spacing['2'],
    },
    listContent: {
      paddingBottom: theme.spacing['2'],
    },
    countryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: theme.spacing['3'],
      borderRadius: theme.borderRadius.base,
      marginBottom: theme.spacing['1'],
    },
    countryItemSelected: {
      backgroundColor: theme.colors.surface,
    },
    flag: {
      fontSize: theme.spacing['6'],
      marginRight: theme.spacing['3'],
    },
    countryName: {
      flex: 1,
      ...theme.typography.body,
      color: theme.colors.text,
    },
    checkmark: {
      width: theme.spacing['5'],
      height: theme.spacing['5'],
      borderRadius: theme.spacing['5'] / 2,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkmarkText: {
      color: theme.colors.white,
      fontSize: theme.spacing['3'],
      fontWeight: 'bold',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing['10'],
    },
    emptyText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: theme.spacing['3'],
      paddingVertical: theme.spacing['4'],
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: 'transparent',
    },
    cancelButton: {
      flex: 1,
      backgroundColor: 'transparent',
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
