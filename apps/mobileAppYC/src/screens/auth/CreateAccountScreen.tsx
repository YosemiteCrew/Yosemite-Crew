// src/screens/auth/CreateAccountScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,

} from 'react-native';
import { SafeArea, Button, Input, Header, PhoneInput, DatePicker } from '../../components/common';
import { useTheme } from '../../hooks';
import { Images } from '../../assets/images';
import { Country } from '../../components/common/CountryPicker/CountryPicker';

interface CreateAccountScreenProps {
  navigation: any;
}

const DEFAULT_COUNTRY: Country = {
  name: 'United States',
  code: 'US',
  dialCode: '+1',
  flag: Images.flagUS,
};

export const CreateAccountScreen: React.FC<CreateAccountScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1 fields
  const [firstName, setFirstName] = useState('Sky');
  const [lastName, setLastName] = useState('');
  
  // Step 2 fields
  const [address, setAddress] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
//   const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [agreeTerms, setAgreeTerms] = useState(false);
  
  // Step 3 fields
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_COUNTRY);
  const [dateOfBirth, setDateOfBirth] = useState<Date>();

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      // Navigate to main app or complete signup
      navigation.navigate('Main');
    }
  };

  const renderStepOne = () => (
    <View style={styles.formContainer}>
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.avatarIcon}>📷</Text>
        </View>
      </View>

      <Input
        label="First name"
        value={firstName}
        onChangeText={setFirstName}
        style={styles.input}
      />

      <Input
        label="Last name"
        value={lastName}
        onChangeText={setLastName}
        style={styles.input}
      />
    </View>
  );

  const renderStepTwo = () => (
    <View style={styles.formContainer}>
      <Input
        placeholder="Address"
        value={address}
        onChangeText={setAddress}
        style={styles.input}
      />

      <Input
        placeholder="State/Province"
        value={state}
        onChangeText={setState}
        style={styles.input}
      />

      <View style={styles.row}>
        <Input
          placeholder="City"
          value={city}
          onChangeText={setCity}
        //   containerStyle={[styles.input, styles.halfWidth]}
        />
        <Input
          placeholder="Postal code"
          value={postalCode}
          onChangeText={setPostalCode}
        //   containerStyle={[styles.input, styles.halfWidth]}
        />
      </View>

      <TouchableOpacity
        style={[styles.countryDropdown, { borderColor: theme.colors.border }]}
        activeOpacity={0.7}
      >
        <Text style={[styles.countryText, { color: theme.colors.text }]}>
          Choose country
        </Text>
        <Text style={[styles.dropdownIcon, { color: theme.colors.textSecondary }]}>
          ▼
        </Text>
      </TouchableOpacity>

      <View style={styles.termsContainer}>
        <TouchableOpacity
          style={[styles.checkbox, agreeTerms && { backgroundColor: theme.colors.primary }]}
          onPress={() => setAgreeTerms(!agreeTerms)}
          activeOpacity={0.7}
        >
          {agreeTerms && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
        <Text style={[styles.termsText, { color: theme.colors.textSecondary }]}>
          I agree to the Yosemite Crew's{' '}
          <Text style={{ color: theme.colors.primary }}>terms and conditions</Text>
          {' '}and{' '}
          <Text style={{ color: theme.colors.primary }}>privacy policy</Text>.
        </Text>
      </View>
    </View>
  );

  const renderStepThree = () => (
    <View style={styles.formContainer}>
      <Input
        label="First name"
        value={firstName}
        onChangeText={setFirstName}
        style={styles.input}
      />

      <Input
        label="Last name"
        value={lastName}
        onChangeText={setLastName}
        style={styles.input}
      />

      <PhoneInput
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        selectedCountry={phoneCountry}
        onCountrySelect={setPhoneCountry}
      />

      <DatePicker
        label="Date of birth (DD Month YYYY)"
        value={dateOfBirth}
        onDateChange={setDateOfBirth}
        maximumDate={new Date()}
        placeholder="Select your birth date"
      />

      <Text style={[styles.ageWarning, { color: theme.colors.error }]}>
        Users should be 18 years or older.
      </Text>
    </View>
  );

  const getStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderStepOne();
      case 2:
        return renderStepTwo();
      case 3:
        return renderStepThree();
      default:
        return renderStepOne();
    }
  };

  const getButtonText = () => {
    return currentStep === 3 ? 'Sign up' : 'Next';
  };

  return (
    <SafeArea style={{ backgroundColor: theme.colors.background }}>
      <Header
        title="Create account"
        showBackButton
        onBack={handleBack}
      />
      
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {getStepContent()}

          <Button
            title={getButtonText()}
            onPress={handleNext}
            style={styles.nextButton}
          />
        </View>
      </ScrollView>
    </SafeArea>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  formContainer: {
    marginBottom: 32,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  avatarIcon: {
    fontSize: 24,
  },
  input: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  countryDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 24,
  },
  countryText: {
    fontSize: 16,
  },
  dropdownIcon: {
    fontSize: 12,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkmark: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  ageWarning: {
    fontSize: 14,
    marginTop: 8,
  },
  nextButton: {
    marginTop: 24,
  },
});