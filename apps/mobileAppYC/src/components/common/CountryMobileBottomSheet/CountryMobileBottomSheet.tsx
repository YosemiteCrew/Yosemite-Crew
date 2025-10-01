// src/components/common/CountryMobileBottomSheet/CountryMobileBottomSheet.tsx
import React, { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  Image,
} from 'react-native';
import CustomBottomSheet from '../BottomSheet/BottomSheet';
import type { BottomSheetRef } from '../BottomSheet/BottomSheet';
import { Input } from '../Input/Input';
import LiquidGlassButton from '../LiquidGlassButton/LiquidGlassButton';
import { useTheme } from '../../../hooks';
import { Images } from '../../../assets/images';

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
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  
  const [tempCountry, setTempCountry] = useState<Country>(selectedCountry);
  const [tempMobile, setTempMobile] = useState<string>(mobileNumber);
  const [searchQuery, setSearchQuery] = useState('');

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
      country.dial_code.includes(searchQuery)
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

  const renderCountryItem = ({ item }: { item: Country }) => {
    const isSelected = item.code === tempCountry.code;
    
    return (
      <TouchableOpacity
        style={[
          styles.countryItem,
          isSelected && { backgroundColor: theme.colors.surface },
        ]}
        onPress={() => setTempCountry(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.flag}>{item.flag}</Text>
        <Text style={[styles.countryName, { color: theme.colors.text }]}>
          {item.name}
        </Text>
        <Text style={[styles.dialCode, { color: theme.colors.textSecondary }]}>
          {item.dial_code}
        </Text>
        {isSelected && (
          <View style={[styles.checkmark, { backgroundColor: theme.colors.primary }]}>
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
  backgroundStyle={{ backgroundColor: theme.colors.background }}
  handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
  keyboardBehavior="interactive"  // Add this
  keyboardBlurBehavior="restore"   // Add this
  android_keyboardInputMode="adjustResize"  // Add this for Android
>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Phone number
          </Text>
          <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: theme.colors.text }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Input Row */}
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={[
              styles.countryCodeBox,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              },
            ]}
            onPress={() => {}}
            activeOpacity={1}
          >
            <Text style={styles.selectedFlag}>{tempCountry.flag}</Text>
            <Text style={[styles.selectedDialCode, { color: theme.colors.text }]}>
              {tempCountry.dial_code}
            </Text>
          </TouchableOpacity>

          <View style={styles.mobileInputWrapper}>
            <Input
              value={tempMobile}
              onChangeText={setTempMobile}
              placeholder="Phone number"
              keyboardType="phone-pad"
              maxLength={15}
            />
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
                borderColor: theme.colors.border,
              },
            ]}
            placeholder="Search country name"
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Image
            source={Images.searchIcon}
            style={[styles.searchIcon, { tintColor: theme.colors.textSecondary }]}
          />
        </View>

        {/* Country List - Fixed Height */}
        <View style={styles.listWrapper}>
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            renderItem={renderCountryItem}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.listContent}
            nestedScrollEnabled={true}
          />
        </View>

        {/* Buttons - Always Visible */}
        <View style={[styles.buttonContainer, { borderTopColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[
              styles.cancelButton,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.background,
              },
            ]}
            onPress={handleCancel}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelText, { color: theme.colors.text }]}>
              Cancel
            </Text>
          </TouchableOpacity>

          <LiquidGlassButton
            title="Save"
            onPress={handleSave}
            style={styles.saveButton}
            textStyle={styles.saveButtonText}
            tintColor={theme.colors.secondary}
            height={50}
            borderRadius="lg"
          />
        </View>
      </View>
    </CustomBottomSheet>
  );
});

CountryMobileBottomSheet.displayName = 'CountryMobileBottomSheet';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    position: 'relative',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    padding: 8,
  },
  closeText: {
    fontSize: 24,
    fontWeight: '300',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 8,
  },
  selectedFlag: {
    fontSize: 24,
  },
  selectedDialCode: {
    fontSize: 16,
    fontWeight: '500',
  },
  mobileInputWrapper: {
    flex: 1,
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
    width: 20,
    height: 20,
  },
  listWrapper: {
    flex: 1,
    maxHeight: 350,
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: 8,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  flag: {
    fontSize: 24,
    marginRight: 12,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
  },
  dialCode: {
    fontSize: 16,
    marginRight: 8,
  },
  checkmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
  },
  cancelButton: {
    flex: 1,
    height: 50,
    borderWidth: 2,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});