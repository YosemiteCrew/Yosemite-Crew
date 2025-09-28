// src/components/common/CountryPicker/CountryPicker.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  TextInput,
} from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useTheme } from '../../../hooks';
import { Images } from '../../../assets/images';

export interface Country {
  name: string;
  code: string;
  dialCode: string;
  flag: any;
}

const COUNTRIES: Country[] = [
  { name: 'United States', code: 'US', dialCode: '+1', flag: Images.flagUS },
  { name: 'India', code: 'IN', dialCode: '+91', flag: Images.flagUS },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: Images.flagUS },
  { name: 'Canada', code: 'CA', dialCode: '+1', flag: Images.flagUS },
  // Add more countries as needed
];

interface CountryPickerProps {
  selectedCountry: Country;
  onSelect: (country: Country) => void;
  bottomSheetRef: React.RefObject<BottomSheet>;
}

export const CountryPicker: React.FC<CountryPickerProps> = ({
//   selectedCountry,
  onSelect,
  bottomSheetRef,
}) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const snapPoints = useMemo(() => ['60%'], []);

  const filteredCountries = useMemo(() => {
    if (!searchQuery) return COUNTRIES;
    return COUNTRIES.filter(country =>
      country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      country.dialCode.includes(searchQuery)
    );
  }, [searchQuery]);

  const handleSelectCountry = (country: Country) => {
    onSelect(country);
    bottomSheetRef.current?.close();
    setSearchQuery('');
  };

  const renderCountryItem = ({ item }: { item: Country }) => (
    <TouchableOpacity
      style={[
        styles.countryItem,
        { borderBottomColor: theme.colors.border }
      ]}
      onPress={() => handleSelectCountry(item)}
      activeOpacity={0.7}
    >
      <Image source={item.flag} style={styles.flag} />
      <View style={styles.countryInfo}>
        <Text style={[styles.countryName, { color: theme.colors.text }]}>
          {item.name}
        </Text>
        <Text style={[styles.dialCode, { color: theme.colors.textSecondary }]}>
          {item.dialCode}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
    >
      <BottomSheetView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Select Country
        </Text>
        
        <TextInput
          style={[
            styles.searchInput,
            {
            //   backgroundColor: theme.colors.inputBackground,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            }
          ]}
          placeholder="Search countries..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        <FlatList
          data={filteredCountries}
          renderItem={renderCountryItem}
          keyExtractor={(item) => item.code}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flag: {
    width: 24,
    height: 18,
    marginRight: 12,
    borderRadius: 2,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 16,
    fontWeight: '500',
  },
  dialCode: {
    fontSize: 14,
    marginTop: 2,
  },
});