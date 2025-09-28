// src/components/common/PhoneInput/PhoneInput.tsx
import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../hooks';
import {  Country } from '../CountryPicker/CountryPicker';
// import { Images } from '../../../assets/images';

interface PhoneInputProps {
  value: string;
  onChangeText: (text: string) => void;
  selectedCountry: Country;
  onCountrySelect: (country: Country) => void;
  error?: string;
  label?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChangeText,
  selectedCountry,

  error,
  label,
}) => {
  const { theme } = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);

  const openCountryPicker = () => {
    bottomSheetRef.current?.expand();
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: theme.colors.text }]}>
          {label}
        </Text>
      )}
      
      <View style={[
        styles.inputContainer,
        {
          borderColor: error ? theme.colors.error : theme.colors.border,
        //   backgroundColor: theme.colors.inputBackground,
        }
      ]}>
        <TouchableOpacity
          style={[styles.countrySelector, { borderRightColor: theme.colors.border }]}
          onPress={openCountryPicker}
          activeOpacity={0.7}
        >
          <Image source={selectedCountry.flag} style={styles.flag} />
          <Text style={[styles.dialCode, { color: theme.colors.text }]}>
            {selectedCountry.dialCode}
          </Text>
          <Text style={[styles.dropdownIcon, { color: theme.colors.textSecondary }]}>
            ▼
          </Text>
        </TouchableOpacity>
        
        <TextInput
          style={[styles.input, { color: theme.colors.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder="Mobile number"
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType="phone-pad"
          returnKeyType="done"
        />
      </View>
      
      {error && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
      )}

      {/* <CountryPicker
        selectedCountry={selectedCountry}
        onSelect={onCountrySelect}
        bottomSheetRef={bottomSheetRef}
      /> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
  },
  flag: {
    width: 24,
    height: 18,
    marginRight: 8,
    borderRadius: 2,
  },
  dialCode: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 4,
  },
  dropdownIcon: {
    fontSize: 10,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  errorText: {
    marginTop: 4,
    fontSize: 14,
  },
});