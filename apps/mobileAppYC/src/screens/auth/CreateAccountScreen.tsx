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
import {useAuth} from '../../contexts/AuthContext';

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

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[2]);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

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

  const handleProfileImageChange = useCallback(
    (imageUri: string | null) => {
      setStep1Data(prev => ({...prev, profileImage: imageUri}));
      setValue('profileImage', imageUri);
    },
    [setValue],
  );

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

  const handleStep1FieldChange = useCallback(
    (field: keyof typeof step1Data, value: any) => {
      setStep1Data(prev => ({...prev, [field]: value}));
      setValue(field, value, {shouldValidate: true});
    },
    [setValue],
  );

  const handleStep2FieldChange = useCallback(
    (field: keyof typeof step2Data, value: any) => {
      setStep2Data(prev => ({...prev, [field]: value}));
      setValue(field, value, {shouldValidate: true});
    },
    [setValue],
  );

  const handleNext = async () => {
    const fieldsToValidate = [
      'firstName',
      'lastName',
      'mobileNumber',
      'dateOfBirth',
    ] as const;
    const isValid = await trigger(fieldsToValidate);

    if (!step1Data.dateOfBirth) {
      setError('dateOfBirth', {
        type: 'manual',
        message: 'Date of birth is required',
      });
      return;
    }

    const birthDate = new Date(step1Data.dateOfBirth);
    const maxDate = getMaximumDate();
    
    if (birthDate > maxDate) {
      setError('dateOfBirth', {
        type: 'manual',
        message: 'You must be at least 18 years old',
      });
      return;
    }

    if (isValid) {
      clearErrors('dateOfBirth');
      setCurrentStep(2);
    }
  };

  const handleGoBack = useCallback(() => {
    if (currentStep === 2) {
      setValue('firstName', step1Data.firstName, {shouldValidate: false});
      setValue('lastName', step1Data.lastName, {shouldValidate: false});
      setValue('mobileNumber', step1Data.mobileNumber, {shouldValidate: false});
      setValue('dateOfBirth', step1Data.dateOfBirth, {shouldValidate: false});
      setValue('profileImage', step1Data.profileImage, {shouldValidate: false});
      clearErrors();
      setCurrentStep(1);
    } else {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('SignUp');
      }
    }
  }, [currentStep, navigation, step1Data, setValue, clearErrors]);

  const handleSignUp = handleSubmit(async () => {
    const combinedData = {
      ...step1Data,
      ...step2Data,
      countryDialCode: selectedCountry.dial_code,
      fullMobileNumber: `${selectedCountry.dial_code}${step1Data.mobileNumber}`,
    };

    if (!combinedData.acceptTerms) {
      setError('acceptTerms', {
        type: 'manual',
        message: 'You must accept the terms and conditions',
      });
      return;
    }

    if (!combinedData.dateOfBirth) {
      setError('dateOfBirth', {
        type: 'manual',
        message: 'Date of birth is required',
      });
      return;
    }

    try {
      console.log('Signup Data:', combinedData);
      
      if (loginsample) {
        await loginsample();
      } else {
        console.error('loginsample function not available');
        navigation.navigate('SignIn');
      }
    } catch (error) {
      console.error('Signup error:', error);
    }
  });

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
              containerStyle={styles.inputContainer}
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
              containerStyle={styles.inputContainer}
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
                  <Text style={styles.dialCodeText}>
                    {selectedCountry.dial_code}
                  </Text>
                </View>
              }
              rightComponent={
                <Image
                  source={Images.dropdownIcon}
                  style={styles.dropdownIcon}
                />
              }
              containerStyle={styles.inputContainer}
            />
          )}
        />

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
                  style={styles.calendarIcon}
                />
              }
              containerStyle={styles.inputContainer}
            />
          )}
        />
      </View>
    </>
  );

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
              containerStyle={styles.inputContainer}
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
              containerStyle={styles.inputContainer}
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
              containerStyle={styles.inputContainer}
            />
          )}
        />

        <View style={styles.checkboxWrapper}>
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
                  // REMOVE: error={errors.acceptTerms?.message}
                />
              )}
            />
            <View style={styles.termsTextContainer}>
              <Text style={styles.checkboxText}>
                I agree to the{' '}
              </Text>
              <TouchableOpacity onPress={() => console.log('Open terms')}>
                <Text style={styles.linkText}>
                  terms and conditions
                </Text>
              </TouchableOpacity>
              <Text style={styles.checkboxText}>
                {' '}and{' '}
              </Text>
              <TouchableOpacity onPress={() => console.log('Open privacy')}>
                <Text style={styles.linkText}>
                  privacy policy.
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* NEW: Error message below the row */}
          {errors.acceptTerms?.message && (
            <Text style={styles.errorText}>
              {errors.acceptTerms.message}
            </Text>
          )}
        </View>

      </View>
    </>
  );

  return (
    <SafeArea style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Image
              source={Images.backIcon}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Create account
          </Text>
          <View style={styles.spacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {currentStep === 1 ? renderStep1() : renderStep2()}
        </ScrollView>

        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title={currentStep === 1 ? 'Next' : 'Sign up'}
            onPress={currentStep === 1 ? handleNext : handleSignUp}
            style={styles.button}
            textStyle={styles.buttonText}
            tintColor={theme.colors.secondary}
            height={56}
            borderRadius={16}
          />
        </View>

        <SimpleDatePicker
          value={step1Data.dateOfBirth}
          onDateChange={handleDateChange}
          show={showDatePicker}
          onDismiss={handleDatePickerDismiss}
          maximumDate={getMaximumDate()}
          mode="date"
        />
      </KeyboardAvoidingView>

      <CountryMobileBottomSheet
        ref={countryMobileRef}
        countries={COUNTRIES}
        selectedCountry={selectedCountry}
        mobileNumber={step1Data.mobileNumber}
        onSave={handleCountryMobileSave}
      />
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
      paddingHorizontal: theme.spacing['5'], // 20
      paddingTop: Platform.OS === 'ios' ? theme.spacing['2'] : theme.spacing['5'], // 8 : 20
      paddingBottom: theme.spacing['2'], // 8
    },
    backButton: {
      width: theme.spacing['8'], // 32
      height: theme.spacing['8'], // 32
      justifyContent: 'center',
      alignItems: 'center',
    },
    backIcon: {
      width: theme.spacing['6'], // 24
      height: theme.spacing['6'], // 24
      tintColor: theme.colors.text,
    },
    headerTitle: {
      flex: 1,
      ...theme.typography.h3,
      color: theme.colors.text,
      textAlign: 'center',
    },
    spacer: {
      width: theme.spacing['8'], // 32
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing['5'], // 20
      paddingBottom: theme.spacing['24'], // 96 - space for fixed button
    },
    formSection: {
      marginBottom: theme.spacing['5'], // 20
    },
    inputContainer: {
      marginBottom: theme.spacing['5'], // 20 - space between inputs + error messages
    },
    countrySection: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: theme.spacing['3'], // 12
      borderRightWidth: 1,
      borderRightColor: theme.colors.border,
    },
    flagText: {
      fontSize: theme.spacing['6'], // 24
      marginRight: theme.spacing['2'], // 8
    },
    dialCodeText: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '500',
    },
    dropdownIcon: {
      width: theme.spacing['3'], // 12
      height: theme.spacing['3'], // 12
      marginLeft: theme.spacing['2'], // 8
      tintColor: theme.colors.textSecondary,
    },
    calendarIcon: {
      width: theme.spacing['5'], // 20
      height: theme.spacing['5'], // 20
      tintColor: theme.colors.textSecondary,
    },
    cityPostalRow: {
      flexDirection: 'row',
      gap: theme.spacing['3'], // 12
      marginBottom: theme.spacing['5'], // 20
    },
    cityWrapper: {
      flex: 1,
    },
    postalWrapper: {
      flex: 1,
    },
     checkboxWrapper: {
      marginBottom: theme.spacing['5'], // 20
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginVertical: theme.spacing['5'], // 20
      paddingRight: theme.spacing['2'], // 8
    },
    checkboxText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      fontSize: 14,
    },
    errorText: {
      ...theme.typography.caption,
      color: theme.colors.error,
      marginTop: theme.spacing['1'], // 4
      marginLeft: theme.spacing['8'], // 32 - align with checkbox text
      fontSize: 12,
    },
    termsTextContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      flex: 1,
      marginLeft: theme.spacing['2'], // 8
    },
    linkText: {
      ...theme.typography.body,
      color: theme.colors.primary,
      textDecorationLine: 'underline',
      fontSize: 14,
    },

    buttonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: theme.spacing['5'], // 20
      paddingTop: theme.spacing['4'], // 16
      paddingBottom: theme.spacing['10'], // 40
      backgroundColor: theme.colors.background,
    },
    button: {
      width: '100%',
    },
    buttonText: {
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
    },
  });