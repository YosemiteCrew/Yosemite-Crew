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


export interface CurrencyBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

interface RawCurrency {
  code: string;
  name: string;
  symbol: string;
  countryCode: string;
}

export interface CurrencyBottomSheetProps {
  selectedCurrency: string;
  onSave: (currency: string) => void;
}

export const CurrencyBottomSheet = forwardRef<
  CurrencyBottomSheetRef,
  CurrencyBottomSheetProps
>(({selectedCurrency, onSave}, ref) => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<BottomSheetRef>(null);

  const [tempCurrency, setTempCurrency] = useState<string>(selectedCurrency);
  const [searchQuery, setSearchQuery] = useState('');

  const styles = createStyles(theme);

  const currencyData = require('../../../utils/currencyList.json');

  const currencies: Currency[] = currencyData.map((currency: RawCurrency) => {
    const COUNTRIES = require('../../../utils/countryList.json');

    // Special flag mappings for currencies without country codes
    const specialFlags: {[key: string]: string} = {
      'EU': '🇪🇺', // European Union
    };

    const country = COUNTRIES.find((c: any) => c.code === currency.countryCode);
    return {
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      flag: specialFlags[currency.countryCode] || country?.flag || '🇺🇸',
    };
  });

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        No results found
      </Text>
    </View>
  );

  useImperativeHandle(ref, () => ({
    open: () => {
      setTempCurrency(selectedCurrency);
      setSearchQuery('');
      bottomSheetRef.current?.snapToIndex(0);
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const filteredCurrencies = currencies.filter(
    currency =>
      currency.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      currency.code.toLowerCase().includes(searchQuery.toLowerCase()) 
  );

  const handleSave = () => {
    onSave(tempCurrency);
    bottomSheetRef.current?.close();
  };

  const handleCancel = () => {
    setTempCurrency(selectedCurrency);
    setSearchQuery('');
    bottomSheetRef.current?.close();
  };

  const renderCurrencyItem = ({item}: {item: Currency}) => {
    const isSelected = item.code === tempCurrency;

    return (
      <TouchableOpacity
        style={[
          styles.currencyItem,
          isSelected && styles.currencyItemSelected,
        ]}
        onPress={() => setTempCurrency(item.code)}
        activeOpacity={0.7}>
        <Text style={styles.flag}>
          {item.flag}
        </Text>
        <Text style={styles.currencyName}>
          {item.name} ({item.symbol})
        </Text>
        <Text style={styles.currencyCode}>
          {item.code}
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
      snapPoints={['75%', '95%']}
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
      android_keyboardInputMode="adjustResize"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Currency
          </Text>
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
            placeholder="Search currency"
            icon={
              <Image
                source={Images.searchIcon}
                style={styles.searchIconImage}
              />
            }
            containerStyle={styles.searchInputContainer}
          />
        </View>

        {/* Currency List - Fixed Height */}
        <View style={styles.listWrapper}>
          <FlatList
            data={filteredCurrencies}
            keyExtractor={(item, index) => `${item.code}-${index}`}
            renderItem={renderCurrencyItem}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.listContent}
            nestedScrollEnabled={true}
            ListEmptyComponent={renderEmptyList}
          />
        </View>

        {/* Buttons - Always Visible */}
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

CurrencyBottomSheet.displayName = 'CurrencyBottomSheet';

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
    currencyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: theme.spacing['3'], // 12
      borderRadius: theme.borderRadius.base, // 8
      marginBottom: theme.spacing['1'], // 4
    },
    flag: {
      fontSize: theme.spacing['6'], // 24
      marginRight: theme.spacing['3'], // 12
    },
    currencyItemSelected: {
      backgroundColor: theme.colors.surface,
    },
    currencyName: {
      flex: 1,
      ...theme.typography.body,
      color: theme.colors.text,
    },
    currencyCode: {
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
