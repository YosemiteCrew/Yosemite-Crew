/* istanbul ignore file -- UI screen with complex native navigation flow; covered via E2E */
// src/screens/Auth/CreateAccountScreen.tsx
import React, {useState, useCallback, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  DeviceEventEmitter,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import {useForm, Controller} from 'react-hook-form';
import {SafeArea, Input, Header} from '../../components/common';
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
import CustomBottomSheet, {
  BottomSheetRef,
} from '../../components/common/BottomSheet/BottomSheet';
import {useTheme} from '../../hooks';
import {Images} from '../../assets/images';
import {Checkbox} from '../../components/common/Checkbox/Checkbox';
import COUNTRIES from '../../utils/countryList.json';
import {TouchableInput} from '../../components/common/TouchableInput/TouchableInput';
import {useAuth, type User} from '../../contexts/AuthContext';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {AuthStackParamList} from '../../navigation/AuthNavigator';
import {PASSWORDLESS_AUTH_CONFIG, PENDING_PROFILE_STORAGE_KEY, PENDING_PROFILE_UPDATED_EVENT} from '@/config/variables';
import LocationService from '@/services/LocationService';
import {
  fetchPlaceDetails,
  fetchPlaceSuggestions,
  MissingApiKeyError,
  type PlaceSuggestion,
} from '@/services/maps/googlePlaces';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Removed direct provider-specific signout; use global logout from AuthContext

type CreateAccountScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'CreateAccount'
>;

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
  route,
}) => {
  const {login, logout} = useAuth();
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const {
    email,
    userId,
    profileToken,
    tokens,
    initialAttributes,
    showOtpSuccess = false,
  } = route.params;

  const maybeParsedDate = initialAttributes?.dateOfBirth
    ? new Date(initialAttributes.dateOfBirth)
    : null;
  const parsedDateOfBirth =
    maybeParsedDate && !Number.isNaN(maybeParsedDate.getTime())
      ? maybeParsedDate
      : null;
  const rawPhone = initialAttributes?.phone?.replaceAll(/[^0-9+]/g, '') ?? '';
  const normalizedPhoneDigits = rawPhone.replaceAll(/\D/g, '');
  const defaultCountry =
    COUNTRIES.find(country => country.code === 'US') ?? COUNTRIES[0];
  const resolvedCountry = (() => {
    if (!normalizedPhoneDigits) {
      return defaultCountry;
    }

    const match = COUNTRIES.find(country => {
      const dialCodeDigits = country.dial_code.replace('+', '');
      return normalizedPhoneDigits.startsWith(dialCodeDigits);
    });

    return match ?? defaultCountry;
  })();
  const localPhoneRaw = normalizedPhoneDigits.startsWith(
    resolvedCountry.dial_code.replace('+', ''),
  )
    ? normalizedPhoneDigits.slice(
        resolvedCountry.dial_code.replace('+', '').length,
      )
    : normalizedPhoneDigits;
  const localPhoneNumber = localPhoneRaw.slice(-10);

  const countryMobileRef = useRef<CountryMobileBottomSheetRef>(null);
  const successBottomSheetRef = useRef<BottomSheetRef>(null);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedCountry, setSelectedCountry] =
    useState<Country>(resolvedCountry);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHandlingBack, setIsHandlingBack] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [isOtpSuccessVisible, setIsOtpSuccessVisible] =
    useState(showOtpSuccess);

  const [step1Data, setStep1Data] = useState({
    firstName: initialAttributes?.firstName ?? '',
    lastName: initialAttributes?.lastName ?? '',
    mobileNumber: localPhoneNumber,
    dateOfBirth: parsedDateOfBirth,
    profileImage: initialAttributes?.profilePicture ?? null,
  });

  const [step2Data, setStep2Data] = useState({
    address: '',
    stateProvince: '',
    city: '',
    postalCode: '',
    country: '',
    acceptTerms: false,
  });
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isFetchingAddressSuggestions, setIsFetchingAddressSuggestions] = useState(false);
  const [addressLookupError, setAddressLookupError] = useState<string | null>(null);
  const skipNextAutocompleteRef = useRef(false);
  const lastAutocompleteSignatureRef = useRef<string>('');

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
      firstName: initialAttributes?.firstName ?? '',
      lastName: initialAttributes?.lastName ?? '',
      countryDialCode: resolvedCountry.dial_code,
      mobileNumber: localPhoneNumber,
      dateOfBirth: parsedDateOfBirth,
      profileImage: initialAttributes?.profilePicture ?? null,
      address: '',
      stateProvince: '',
      city: '',
      postalCode: '',
      country: '',
      acceptTerms: false,
    },
    mode: 'onChange',
  });

  useEffect(() => {
    let isMounted = true;

    const fetchLocation = async () => {
      setIsRequestingLocation(true);

      try {
        const coords = await LocationService.getLocationWithRetry();
        if (coords && isMounted) {
          setLocation({latitude: coords.latitude, longitude: coords.longitude});
        }
      } catch (error) {
        console.warn('Unable to fetch location', error);
      } finally {
        if (isMounted) {
          setIsRequestingLocation(false);
        }
      }
    };

    fetchLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!successBottomSheetRef.current) {
      return;
    }

    if (isOtpSuccessVisible) {
      requestAnimationFrame(() => {
        successBottomSheetRef.current?.snapToIndex(0);
      });
    } else {
      requestAnimationFrame(() => {
        successBottomSheetRef.current?.forceClose();
      });
    }
  }, [isOtpSuccessVisible]);

  const handleSuccessClose = useCallback(() => {
    requestAnimationFrame(() => {
      successBottomSheetRef.current?.forceClose();
    });
    setIsOtpSuccessVisible(false);
    navigation.setParams({showOtpSuccess: false});
  }, [navigation]);

  const handleProfileImageChange = useCallback(
    (imageUri: string | null) => {
      setStep1Data(prev => ({...prev, profileImage: imageUri}));
      setValue('profileImage', imageUri, {shouldValidate: true});
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
      if (field === 'address') {
        setAddressQuery(value);
      }
      if (
        field === 'address' ||
        field === 'stateProvince' ||
        field === 'city' ||
        field === 'postalCode' ||
        field === 'country'
      ) {
        clearErrors(field);
      }
    },
    [clearErrors, setValue],
  );

  useEffect(() => {
    if (skipNextAutocompleteRef.current) {
      skipNextAutocompleteRef.current = false;
      return;
    }

    const search = addressQuery.trim();
    if (search.length < 3) {
      setAddressSuggestions([]);
      setAddressLookupError(null);
      lastAutocompleteSignatureRef.current = '';
      return;
    }

    const locationSignature = location
      ? `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`
      : 'none';
    const signature = `${search}::${locationSignature}`;

    if (signature === lastAutocompleteSignatureRef.current) {
      return;
    }

    lastAutocompleteSignatureRef.current = signature;

    let isActive = true;
    setIsFetchingAddressSuggestions(true);
    const timeoutId = setTimeout(async () => {
      try {
        const suggestions = await fetchPlaceSuggestions({
          query: search,
          location,
        });
        if (!isActive) {
          return;
        }
        setAddressSuggestions(suggestions);
        setAddressLookupError(null);
      } catch (error) {
        if (!isActive) {
          return;
        }
        if (error instanceof MissingApiKeyError) {
          setAddressLookupError(
            'Address autocomplete is unavailable. Please enter your address manually.',
          );
        } else {
          setAddressLookupError('Unable to fetch address suggestions.');
        }
        setAddressSuggestions([]);
      } finally {
        if (isActive) {
          setIsFetchingAddressSuggestions(false);
        }
      }
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [addressQuery, location]);

  const handleAddressSuggestionPress = useCallback(
    async (suggestion: PlaceSuggestion) => {
      skipNextAutocompleteRef.current = true;
      lastAutocompleteSignatureRef.current = '';
      setIsFetchingAddressSuggestions(true);
      try {
        const details = await fetchPlaceDetails(suggestion.placeId);
        const addressLine = details.addressLine ?? suggestion.primaryText;

        handleStep2FieldChange('address', addressLine);
        setAddressQuery(addressLine);

        console.log('[CreateAccount] Selected address', {
          placeId: suggestion.placeId,
          addressLine,
          city: details.city,
          stateProvince: details.stateProvince,
          postalCode: details.postalCode,
          country: details.country,
        });

        if (details.city) {
          handleStep2FieldChange('city', details.city);
        }
        if (details.stateProvince) {
          handleStep2FieldChange('stateProvince', details.stateProvince);
        }
        if (details.postalCode) {
          handleStep2FieldChange('postalCode', details.postalCode);
        }
        if (details.country) {
          handleStep2FieldChange('country', details.country);
        }
        if (details.latitude && details.longitude) {
          setLocation(prev =>
            prev ?? {
              latitude: details.latitude as number,
              longitude: details.longitude as number,
            },
          );
        }
        setAddressLookupError(null);
        clearErrors(['address', 'city', 'stateProvince', 'postalCode', 'country']);
      } catch (error) {
        if (error instanceof MissingApiKeyError) {
          setAddressLookupError(
            'Address autocomplete is unavailable. Please enter your address manually.',
          );
        } else {
          setAddressLookupError('Unable to fetch the selected address details.');
        }
      } finally {
        setAddressSuggestions([]);
        setIsFetchingAddressSuggestions(false);
      }
    },
    [clearErrors, handleStep2FieldChange, setLocation],
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

const handleGoBack = useCallback(async () => {
  // If on step 2, just go back to step 1 - NO LOGOUT NEEDED
  if (currentStep === 2) {
    setValue('firstName', step1Data.firstName, {shouldValidate: false});
    setValue('lastName', step1Data.lastName, {shouldValidate: false});
    setValue('mobileNumber', step1Data.mobileNumber, {shouldValidate: false});
    setValue('dateOfBirth', step1Data.dateOfBirth, {shouldValidate: false});
    setValue('profileImage', step1Data.profileImage, {shouldValidate: false});
    clearErrors();
    setCurrentStep(1);
    return;
  }

  // If on step 1, cancel the profile creation and go back to sign up
  if (isHandlingBack) {
    return;
  }

  setIsHandlingBack(true);
  try {
    console.log('[CreateAccountScreen] Cancelling profile creation - provider:', tokens.provider);
    // 1) Clear pending profile immediately so AppNavigator stops forcing CreateAccount
    await AsyncStorage.removeItem(PENDING_PROFILE_STORAGE_KEY);
    DeviceEventEmitter.emit(PENDING_PROFILE_UPDATED_EVENT);

    // 2) Use global logout to clear tokens/state consistently (handles provider-specific signout)
    await logout();

    // 3) Explicitly reset to SignIn so user sees the auth entry point immediately
    navigation.reset({
      index: 0,
      routes: [{name: 'SignIn'}],
    });
  } catch (error) {
    console.error('[CreateAccountScreen] handleGoBack error:', error);
    try {
      await AsyncStorage.removeItem(PENDING_PROFILE_STORAGE_KEY);
      DeviceEventEmitter.emit(PENDING_PROFILE_UPDATED_EVENT);
    } catch {}
    // Even on failure, rely on AppNavigator by not forcing a conflicting reset
    navigation.reset({
      index: 0,
      routes: [{name: 'SignIn'}],
    });
  } finally {
    setIsHandlingBack(false);
  }
}, [clearErrors, currentStep, isHandlingBack, logout, navigation, setValue, step1Data, tokens.provider]);

  // Ensure hardware back behaves same as header back
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleGoBack();
      return true;
    });
    return () => sub.remove();
  }, [handleGoBack]);

  const createAccountEndpoint = PASSWORDLESS_AUTH_CONFIG.createAccountUrl;

  const submitCreateAccount = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!createAccountEndpoint) {
        await new Promise(resolve => setTimeout(resolve, 1200));
        return {success: true};
      }

      const getLocationStatus = () => {
        if (location) {
          return 'collected';
        }
        if (isRequestingLocation) {
          return 'pending';
        }
        return 'unavailable';
      };

      const outgoingPayload = {
        ...payload,
        location: location
          ? {
              latitude: location.latitude,
              longitude: location.longitude,
            }
          : null,
        locationStatus: getLocationStatus(),
      };

      const response = await fetch(createAccountEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
          'x-profile-token': profileToken,
        },
        body: JSON.stringify(outgoingPayload),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(
          message ||
            'We could not create your account right now. Please try again.',
        );
      }

      return response.json().catch(() => ({success: true}));
    },
    [
      createAccountEndpoint,
      isRequestingLocation,
      location,
      profileToken,
      tokens.accessToken,
    ],
  );

  const handleSignUp = handleSubmit(async () => {
    const combinedData = {
      ...step1Data,
      ...step2Data,
      countryDialCode: selectedCountry.dial_code,
      currency: 'USD',
      fullMobileNumber: `${selectedCountry.dial_code}${step1Data.mobileNumber}`,
    };

    setSubmissionError('');

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
      setIsSubmitting(true);
      await submitCreateAccount({
        email,
        userId,
        profileToken,
        firstName: combinedData.firstName,
        lastName: combinedData.lastName,
        phone: combinedData.fullMobileNumber,
        dateOfBirth: combinedData.dateOfBirth?.toISOString(),
        address: {
          addressLine: combinedData.address,
          stateProvince: combinedData.stateProvince,
          city: combinedData.city,
          postalCode: combinedData.postalCode,
          country: combinedData.country,
        },
      });

      await AsyncStorage.removeItem(PENDING_PROFILE_STORAGE_KEY);
      DeviceEventEmitter.emit(PENDING_PROFILE_UPDATED_EVENT);

     const userPayload: User = {
  id: userId,
  email,
  firstName: combinedData.firstName,
  lastName: combinedData.lastName,
  phone: combinedData.fullMobileNumber,
  dateOfBirth: combinedData.dateOfBirth?.toISOString().split('T')[0],
  profilePicture: combinedData.profileImage ?? undefined,
  profileToken,
  currency: combinedData.currency ?? undefined,
  address: {
    addressLine: combinedData.address,
    stateProvince: combinedData.stateProvince,
    city: combinedData.city,
    postalCode: combinedData.postalCode,
    country: combinedData.country,
  },
};


      await login(userPayload, tokens);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while creating your account. Please try again.';
      setSubmissionError(message);
      console.error('Signup error:', error);
    } finally {
      setIsSubmitting(false);
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
              value: /^\d{10}$/,
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

        {(isFetchingAddressSuggestions || addressSuggestions.length > 0 || addressLookupError) && (
          <View style={styles.addressAutocompleteContainer}>
            {isFetchingAddressSuggestions ? (
              <View style={styles.addressAutocompleteLoadingRow}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.addressAutocompleteLoadingText}>Searching for addresses…</Text>
              </View>
            ) : null}
            {!isFetchingAddressSuggestions &&
              addressSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={suggestion.placeId}
                  style={[
                    styles.addressSuggestionItem,
                    index === addressSuggestions.length - 1 && styles.addressSuggestionItemLast,
                  ]}
                  onPress={() => handleAddressSuggestionPress(suggestion)}
                >
                  <Text style={styles.addressSuggestionPrimary}>{suggestion.primaryText}</Text>
                  {suggestion.secondaryText ? (
                    <Text style={styles.addressSuggestionSecondary}>{suggestion.secondaryText}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            {addressLookupError && !isFetchingAddressSuggestions ? (
              <Text style={styles.addressSuggestionError}>{addressLookupError}</Text>
            ) : null}
            {(isFetchingAddressSuggestions || addressSuggestions.length > 0) && (
              <Text style={styles.addressPoweredBy}>Powered by Google</Text>
            )}
          </View>
        )}

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
                  // eslint-disable-next-line no-useless-escape
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
                />
              )}
            />
            <View style={styles.termsTextContainer}>
              <Text style={styles.checkboxText}>I agree to the </Text>
              <TouchableOpacity onPress={() => console.log('Open terms')}>
                <Text style={styles.linkText}>terms and conditions</Text>
              </TouchableOpacity>
              <Text style={styles.checkboxText}> and </Text>
              <TouchableOpacity onPress={() => console.log('Open privacy')}>
                <Text style={styles.linkText}>privacy policy.</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* NEW: Error message below the row */}
          {errors.acceptTerms?.message && (
            <Text style={styles.errorText}>{errors.acceptTerms.message}</Text>
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
      <Header
  title="Create account"
  showBackButton
  onBack={handleGoBack}
/>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {currentStep === 1 ? renderStep1() : renderStep2()}
        </ScrollView>

        {submissionError ? (
          <Text style={styles.submissionError}>{submissionError}</Text>
        ) : null}

        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title={(() => {
              if (currentStep === 1) {
                return 'Next';
              }
              if (isSubmitting) {
                return 'Creating account...';
              }
              return 'Create account';
            })()}
            onPress={currentStep === 1 ? handleNext : handleSignUp}
            style={styles.button}
            textStyle={styles.buttonText}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            forceBorder
            borderColor="rgba(255, 255, 255, 0.35)"
            height={56}
            borderRadius={16}
            loading={currentStep === 2 && isSubmitting}
            disabled={currentStep === 2 && isSubmitting}
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
      <View
        style={styles.bottomSheetContainer}
        pointerEvents={isOtpSuccessVisible ? 'auto' : 'none'}>
        <CustomBottomSheet
          ref={successBottomSheetRef}
          snapPoints={['35%', '50%']}
          initialIndex={isOtpSuccessVisible ? 1 : -1}
          enablePanDownToClose
          enableBackdrop
          backdropOpacity={0.5}
          backdropAppearsOnIndex={0}
          backdropDisappearsOnIndex={-1}
          backdropPressBehavior="close"
          enableHandlePanningGesture
          enableContentPanningGesture={false}
          enableOverDrag
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetHandle}>
          <View style={styles.successContent}>
            <Image
              source={Images.verificationSuccess}
              style={styles.successIllustration}
              resizeMode="contain"
            />
            <Text style={styles.successTitle}>Code verified</Text>
            <Text style={styles.successMessage}>
              Nice! Now let's finish setting up your Yosemite Crew profile.
            </Text>
            <LiquidGlassButton
              title="Continue"
              onPress={handleSuccessClose}
              style={styles.successButton}
              textStyle={styles.successButtonText}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              forceBorder
              borderColor="rgba(255, 255, 255, 0.35)"
              height={56}
              borderRadius={16}
            />
          </View>
        </CustomBottomSheet>
      </View>
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
    addressAutocompleteContainer: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      marginBottom: theme.spacing['5'],
      overflow: 'hidden',
    },
    addressAutocompleteLoadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['3'],
      gap: theme.spacing['3'],
    },
    addressAutocompleteLoadingText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    addressSuggestionItem: {
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['4'],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    addressSuggestionItemLast: {
      borderBottomWidth: 0,
    },
    addressSuggestionPrimary: {
      ...theme.typography.paragraph,
      color: theme.colors.text,
    },
    addressSuggestionSecondary: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing['1'],
    },
    addressSuggestionError: {
      ...theme.typography.caption,
      color: theme.colors.error,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['3'],
      backgroundColor: theme.colors.cardBackground,
    },
    addressPoweredBy: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textAlign: 'right',
      paddingHorizontal: theme.spacing['4'],
      paddingBottom: theme.spacing['3'],
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

    submissionError: {
      ...theme.typography.paragraphBold,
      color: theme.colors.error,
      textAlign: 'center',
      paddingHorizontal: theme.spacing['5'],
      marginBottom: theme.spacing['2'],
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
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.35)',
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 8},
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    buttonText: {
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
    },
    bottomSheetContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      elevation: 9999,
      justifyContent: 'flex-end',
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
    successContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingBottom: 40,
      gap: 16,
    },
    successIllustration: {
      height: 170,
      marginBottom: 16,
    },
    successTitle: {
      ...theme.typography.h3,
      color: theme.colors.text,
      textAlign: 'center',
    },
    successMessage: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    successButton: {
      width: '100%',
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.35)',
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 8},
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    successButtonText: {
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
    },
  });
