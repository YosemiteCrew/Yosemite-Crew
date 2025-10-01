// src/screens/Auth/CreateAccountScreen.tsx
import React, {useState, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useForm, Controller} from 'react-hook-form';
import {SafeArea, Input} from '../../components/common';
import {
  SimpleDatePicker,
  formatDateForDisplay,
} from '../../components/common/SimpleDatePicker/SimpleDatePicker';
import {ProfileImagePicker} from '../../components/common/ProfileImagePicker/ProfileImagePicker';
import {
  CountryMobileBottomSheet,
  CountryMobileBottomSheetRef,
} from '../../components/common/CountryMobileBottomSheet/CountryMobileBottomSheet';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '../../hooks';
import {Images} from '../../assets/images';
import {Checkbox} from '../../components/common/Checkbox/Checkbox';
import COUNTRIES from '../../utils/countryList.json';
import {TouchableInput} from '../../components/common/TouchableInput/TouchableInput';
import {useAuth} from '../../contexts/AuthContext'; // Update this import
interface CreateAccountScreenProps {
  navigation: any;
}

interface Country {
  name: string;
  flag: string;
  code: string;
  dial_code: string;
}

interface FormData {
  firstName: string;
  lastName: string;
  countryDialCode: string;
  mobileNumber: string;
  dateOfBirth: Date | null;
  profileImage: string | null;
  address: string;
  stateProvince: string;
  city: string;
  postalCode: string;
  country: string;
  acceptTerms: boolean;
}

export const CreateAccountScreen: React.FC<CreateAccountScreenProps> = ({
  navigation,
}) => {
  const {loginsample} = useAuth();
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const countryMobileRef = useRef<CountryMobileBottomSheetRef>(null);

  // Form state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[2]); // India default
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  // Separate form state for each step to prevent data sharing between steps
  const [step1Data, setStep1Data] = useState({
    firstName: '',
    lastName: '',
    mobileNumber: '',
    dateOfBirth: null as Date | null,
    profileImage: null as string | null,
  });

  const [step2Data, setStep2Data] = useState({
    address: '',
    stateProvince: '',
    city: '',
    postalCode: '',
    country: '',
    acceptTerms: false,
  });

  const {
    control,
    handleSubmit,
    formState: {errors},
    trigger,
    setValue,
    setError,
    clearErrors,
  } = useForm<FormData>({
    defaultValues: {
      firstName: '',
      lastName: '',
      countryDialCode: COUNTRIES[2].dial_code,
      mobileNumber: '',
      dateOfBirth: null,
      profileImage: null,
      address: '',
      stateProvince: '',
      city: '',
      postalCode: '',
      country: '',
      acceptTerms: false,
    },
    mode: 'onChange',
  });

  // Profile Image Handler
  const handleProfileImageChange = useCallback(
    (imageUri: string | null) => {
      setStep1Data(prev => ({...prev, profileImage: imageUri}));
      setValue('profileImage', imageUri);
    },
    [setValue],
  );

  // Country & Mobile Number Handlers
  const handleCountryMobilePress = useCallback(() => {
    countryMobileRef.current?.open();
  }, []);

  const handleCountryMobileSave = useCallback(
    (country: Country, mobile: string) => {
      setSelectedCountry(country);
      setStep1Data(prev => ({...prev, mobileNumber: mobile}));
      setValue('countryDialCode', country.dial_code, {shouldValidate: true});
      setValue('mobileNumber', mobile, {shouldValidate: true});
    },
    [setValue],
  );

  // Date Picker Handlers
  const handleDatePickerPress = useCallback(() => {
    setShowDatePicker(true);
  }, []);

  const handleDateChange = useCallback(
    (date: Date) => {
      setStep1Data(prev => ({...prev, dateOfBirth: date}));
      setValue('dateOfBirth', date, {shouldValidate: true});
      setShowDatePicker(false);
    },
    [setValue],
  );

  const handleDatePickerDismiss = useCallback(() => {
    setShowDatePicker(false);
  }, []);

  const getMaximumDate = useCallback(() => {
    const today = new Date();
    return new Date(
      today.getFullYear() - 18,
      today.getMonth(),
      today.getDate(),
    );
  }, []);

  // Field change handlers for step 1
  const handleStep1FieldChange = useCallback(
    (field: keyof typeof step1Data, value: any) => {
      setStep1Data(prev => ({...prev, [field]: value}));
      setValue(field, value, {shouldValidate: true});
    },
    [setValue],
  );

  // Field change handlers for step 2
  const handleStep2FieldChange = useCallback(
    (field: keyof typeof step2Data, value: any) => {
      setStep2Data(prev => ({...prev, [field]: value}));
      setValue(field, value, {shouldValidate: true});
    },
    [setValue],
  );

  // Navigation Handlers
// In handleNext function, replace the age validation section with:
const handleNext = async () => {
  // Validate step 1 fields
  const fieldsToValidate = [
    'firstName',
    'lastName',
    'mobileNumber',
    'dateOfBirth',
  ] as const;
  const isValid = await trigger(fieldsToValidate);

  // Additional manual validation for date of birth
  if (!step1Data.dateOfBirth) {
    setError('dateOfBirth', {
      type: 'manual',
      message: 'Date of birth is required',
    });
    return;
  }

  // Validate age is 18+
  const birthDate = new Date(step1Data.dateOfBirth);
  const maxDate = getMaximumDate(); // This is already the date 18 years ago
  
  // Check if birth date is after the maximum allowed date (meaning they're younger than 18)
  if (birthDate > maxDate) {
    setError('dateOfBirth', {
      type: 'manual',
      message: 'You must be at least 18 years old',
    });
    return;
  }

  if (isValid) {
    clearErrors('dateOfBirth'); // Clear any previous errors
    setCurrentStep(2);
  }
};

// Modify handleGoBack to re-sync form values when going back:
const handleGoBack = useCallback(() => {
  if (currentStep === 2) {
    // Re-sync step 1 values with form state when going back
    setValue('firstName', step1Data.firstName, {shouldValidate: false});
    setValue('lastName', step1Data.lastName, {shouldValidate: false});
    setValue('mobileNumber', step1Data.mobileNumber, {shouldValidate: false});
    setValue('dateOfBirth', step1Data.dateOfBirth, {shouldValidate: false});
    setValue('profileImage', step1Data.profileImage, {shouldValidate: false});
    clearErrors(); // Clear all errors when going back
    setCurrentStep(1);
  } else {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('SignUp');
    }
  }
}, [currentStep, navigation, step1Data, setValue, clearErrors]);

  // Form Submit Handler
// Form Submit Handler
const handleSignUp = handleSubmit(async () => {
  // Combine data from both steps
  const combinedData = {
    ...step1Data,
    ...step2Data,
    countryDialCode: selectedCountry.dial_code,
    fullMobileNumber: `${selectedCountry.dial_code}${step1Data.mobileNumber}`,
  };

  // Manual validation for terms acceptance
  if (!combinedData.acceptTerms) {
    setError('acceptTerms', {
      type: 'manual',
      message: 'You must accept the terms and conditions',
    });
    return;
  }

  // Validate all required fields are present
  if (!combinedData.dateOfBirth) {
    setError('dateOfBirth', {
      type: 'manual',
      message: 'Date of birth is required',
    });
    return;
  }

  try {
    console.log('Signup Data:', combinedData);

    // Call your signup API here
    // const response = await signupAPI(combinedData);
    
    // After successful signup, log in the user
    if (loginsample) {
      await loginsample();
      // Navigation will be handled automatically by AppNavigator
      // when isLoggedIn becomes true
    } else {
      console.error('loginsample function not available');
      navigation.navigate('SignIn');
    }
  } catch (error) {
    console.error('Signup error:', error);
    // Handle error appropriately (show error message to user)
  }
});

  // Step 1 Content
  const renderStep1 = () => (
    <>
      <ProfileImagePicker
        imageUri={step1Data.profileImage}
        onImageSelected={handleProfileImageChange}
      />

      <View style={styles.formSection}>
        <Controller
          control={control}
          name="firstName"
          rules={{
            required: 'First name is required',
            minLength: {
              value: 2,
              message: 'First name must be at least 2 characters',
            },
            pattern: {
              value: /^[A-Za-z\s]+$/,
              message: 'First name can only contain letters and spaces',
            },
          }}
          render={({field: {onChange}}) => (
            <Input
              label="First name"
              value={step1Data.firstName}
              onChangeText={text => {
                handleStep1FieldChange('firstName', text);
                onChange(text);
              }}
              error={errors.firstName?.message}
              maxLength={50}
            />
          )}
        />

        <Controller
          control={control}
          name="lastName"
          rules={{
            required: 'Last name is required',
            minLength: {
              value: 2,
              message: 'Last name must be at least 2 characters',
            },
            pattern: {
              value: /^[A-Za-z\s]+$/,
              message: 'Last name can only contain letters and spaces',
            },
          }}
          render={({field: {onChange}}) => (
            <Input
              label="Last name"
              value={step1Data.lastName}
              onChangeText={text => {
                handleStep1FieldChange('lastName', text);
                onChange(text);
              }}
              error={errors.lastName?.message}
              maxLength={50}
            />
          )}
        />

        <Controller
          control={control}
          name="mobileNumber"
          rules={{
            required: 'Mobile number is required',
            pattern: {
              value: /^[0-9]{10}$/,
              message: 'Please enter a valid 10-digit mobile number',
            },
          }}
          render={() => (
            <TouchableInput
              label="Mobile number"
              value={step1Data.mobileNumber}
              placeholder="Phone number"
              onPress={handleCountryMobilePress}
              error={errors.mobileNumber?.message}
              leftComponent={
                <View style={styles.countrySection}>
                  <Text style={styles.flagText}>{selectedCountry.flag}</Text>
                  <Text
                    style={[styles.dialCodeText, {color: theme.colors.text}]}>
                    {selectedCountry.dial_code}
                  </Text>
                </View>
              }
              rightComponent={
                <Image
                  source={Images.dropdownIcon}
                  style={[
                    styles.dropdownIcon,
                    {tintColor: theme.colors.textSecondary},
                  ]}
                />
              }
              containerStyle={{marginBottom: 16}}
            />
          )}
        />

        {/* Date of Birth Field */}
        <Controller
          control={control}
          name="dateOfBirth"
          rules={{required: 'Date of birth is required'}}
          render={() => (
            <TouchableInput
              label="Date of birth"
              value={
                step1Data.dateOfBirth
                  ? formatDateForDisplay(step1Data.dateOfBirth)
                  : ''
              }
              placeholder="Select date of birth"
              onPress={handleDatePickerPress}
              error={errors.dateOfBirth?.message}
              rightComponent={
                <Image
                  source={Images.calendarIcon}
                  style={[
                    styles.calendarIcon,
                    {tintColor: theme.colors.textSecondary},
                  ]}
                />
              }
              containerStyle={{marginBottom: 16}}
            />
          )}
        />
      </View>

      <LiquidGlassButton
        title="Next"
        onPress={handleNext}
        style={styles.button}
        textStyle={styles.buttonText}
        tintColor={theme.colors.secondary}
        height={56}
        borderRadius="lg"
      />
    </>
  );

  // Step 2 Content
  const renderStep2 = () => (
    <>
      <ProfileImagePicker
        imageUri={step1Data.profileImage}
        onImageSelected={handleProfileImageChange}
      />

      <View style={styles.formSection}>
        <Controller
          control={control}
          name="address"
          rules={{
            required: 'Address is required',
            minLength: {
              value: 5,
              message: 'Address must be at least 5 characters',
            },
          }}
          render={({field: {onChange}}) => (
            <Input
              label="Address"
              value={step2Data.address}
              onChangeText={text => {
                handleStep2FieldChange('address', text);
                onChange(text);
              }}
              error={errors.address?.message}
              multiline
              maxLength={200}
            />
          )}
        />

        <Controller
          control={control}
          name="stateProvince"
          rules={{
            required: 'State/Province is required',
            pattern: {
              value: /^[A-Za-z\s]+$/,
              message: 'State/Province can only contain letters and spaces',
            },
          }}
          render={({field: {onChange}}) => (
            <Input
              label="State/Province"
              value={step2Data.stateProvince}
              onChangeText={text => {
                handleStep2FieldChange('stateProvince', text);
                onChange(text);
              }}
              error={errors.stateProvince?.message}
              maxLength={50}
            />
          )}
        />

        <View style={styles.cityPostalRow}>
          <View style={styles.cityWrapper}>
            <Controller
              control={control}
              name="city"
              rules={{
                required: 'City is required',
                pattern: {
                  value: /^[A-Za-z\s]+$/,
                  message: 'City can only contain letters and spaces',
                },
              }}
              render={({field: {onChange}}) => (
                <Input
                  label="City"
                  value={step2Data.city}
                  onChangeText={text => {
                    handleStep2FieldChange('city', text);
                    onChange(text);
                  }}
                  error={errors.city?.message}
                  maxLength={50}
                />
              )}
            />
          </View>
          <View style={styles.postalWrapper}>
            <Controller
              control={control}
              name="postalCode"
              rules={{
                required: 'Postal code is required',
                pattern: {
                  value: /^[A-Za-z0-9\s\-]+$/,
                  message:
                    'Postal code can only contain letters, numbers, spaces and hyphens',
                },
              }}
              render={({field: {onChange}}) => (
                <Input
                  label="Postal code"
                  value={step2Data.postalCode}
                  onChangeText={text => {
                    handleStep2FieldChange('postalCode', text);
                    onChange(text);
                  }}
                  keyboardType="default"
                  error={errors.postalCode?.message}
                  maxLength={10}
                />
              )}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="country"
          rules={{
            required: 'Country is required',
            pattern: {
              value: /^[A-Za-z\s]+$/,
              message: 'Country can only contain letters and spaces',
            },
          }}
          render={({field: {onChange}}) => (
            <Input
              label="Country"
              value={step2Data.country}
              onChangeText={text => {
                handleStep2FieldChange('country', text);
                onChange(text);
              }}
              error={errors.country?.message}
              maxLength={50}
            />
          )}
        />

        <View style={styles.checkboxContainer}>
          <Controller
            control={control}
            name="acceptTerms"
            render={() => (
              <Checkbox
                value={step2Data.acceptTerms}
                onValueChange={checked => {
                  handleStep2FieldChange('acceptTerms', checked);
                  if (checked) {
                    clearErrors('acceptTerms');
                  }
                }}
                error={errors.acceptTerms?.message}
              />
            )}
          />
          <View style={styles.termsTextContainer}>
            <Text
              style={[
                styles.checkboxText,
                {color: theme.colors.textSecondary},
              ]}>
              I agree to the{' '}
            </Text>
            <TouchableOpacity onPress={() => console.log('Open terms')}>
              <Text style={[styles.linkText, {color: theme.colors.primary}]}>
                terms and conditions
              </Text>
            </TouchableOpacity>
            <Text
              style={[
                styles.checkboxText,
                {color: theme.colors.textSecondary},
              ]}>
              {' '}
              and{' '}
            </Text>
            <TouchableOpacity onPress={() => console.log('Open privacy')}>
              <Text style={[styles.linkText, {color: theme.colors.primary}]}>
                privacy policy.
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={[styles.divider, {backgroundColor: theme.colors.border}]}
        />
      </View>

      <LiquidGlassButton
        title="Sign up"
        onPress={handleSignUp}
        style={styles.button}
        textStyle={styles.buttonText}
        tintColor={theme.colors.secondary}
        height={56}
        borderRadius="lg"
      />
    </>
  );

  return (
    <SafeArea style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Image
              source={Images.backIcon}
              style={[styles.backIcon, {tintColor: theme.colors.text}]}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: theme.colors.text}]}>
            Create account
          </Text>
          <View style={styles.spacer} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {currentStep === 1 ? renderStep1() : renderStep2()}
        </ScrollView>

        {/* Country Mobile Bottom Sheet */}
         {currentStep === 1 && (
        <CountryMobileBottomSheet
          ref={countryMobileRef}
          countries={COUNTRIES}
          selectedCountry={selectedCountry}
          mobileNumber={step1Data.mobileNumber}
          onSave={handleCountryMobileSave}
        />
      )}

        <SimpleDatePicker
          value={step1Data.dateOfBirth}
          onDateChange={handleDateChange}
          show={showDatePicker}
          onDismiss={handleDatePickerDismiss}
          maximumDate={getMaximumDate()}
          mode="date"
        />
      </KeyboardAvoidingView>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 10 : 20,
      paddingBottom: 10,
    },
    backButton: {
      width: 30,
      height: 30,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backIcon: {
      width: 24,
      height: 24,
    },
    headerTitle: {
      flex: 1,
      fontSize: 20,
      fontWeight: '600',
      textAlign: 'center',
    },
    spacer: {
      width: 30,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    formSection: {
      marginBottom: 20,
    },
    label: {
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 8,
    },
    countrySection: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: 12,
      borderRightWidth: 1,
      borderRightColor: '#E0E0E0',
    },
    flagText: {
      fontSize: 24,
      marginRight: 8,
    },
    dialCodeText: {
      fontSize: 16,
      fontWeight: '500',
    },
    dropdownIcon: {
      width: 12,
      height: 12,
      marginLeft: 8,
    },
    calendarIcon: {
      width: 20,
      height: 20,
    },
    errorText: {
      marginTop: 4,
      fontSize: 14,
    },
    cityPostalRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    cityWrapper: {
      flex: 1,
    },
    postalWrapper: {
      flex: 1,
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginVertical: 20,
      paddingRight: 10,
    },
    checkboxText: {
      fontSize: 14,
    },
    termsTextContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      flex: 1,
      marginLeft: 8,
    },
    linkText: {
      textDecorationLine: 'underline',
      fontSize: 14,
    },
    divider: {
      height: 1,
      marginVertical: 20,
    },
    button: {
      marginTop: 20,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });
