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
} from 'react-native';
import {useForm, Controller} from 'react-hook-form';
import {SafeArea, Input, Header} from '@/shared/components/common';
import {
  SimpleDatePicker,
  formatDateForDisplay,
} from '@/shared/components/common/SimpleDatePicker/SimpleDatePicker';
import {ProfileImagePicker} from '@/shared/components/common/ProfileImagePicker/ProfileImagePicker';
import {
  CountryMobileBottomSheet,
  CountryMobileBottomSheetRef,
} from '@/shared/components/common/CountryMobileBottomSheet/CountryMobileBottomSheet';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import CustomBottomSheet, {
  BottomSheetRef,
} from '@/shared/components/common/BottomSheet/BottomSheet';
import {AddressFields, type AddressFieldValues} from '@/shared/components/forms/AddressFields';
import {useTheme, useAddressAutocomplete} from '@/hooks';
import {createFormScreenStyles} from '@/shared/utils/formScreenStyles';
import {Images} from '@/assets/images';
import {Checkbox} from '@/shared/components/common/Checkbox/Checkbox';
import COUNTRIES from '@/shared/utils/countryList.json';
import {TouchableInput} from '@/shared/components/common/TouchableInput/TouchableInput';
import {useAuth, type User} from '@/features/auth/context/AuthContext';
import {
  createParentProfile,
  updateParentProfile,
  type ParentProfileUpsertPayload,
} from '@/features/account/services/profileService';
import {mergeUserWithParentProfile} from '@/features/auth/utils/parentProfileMapper';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {AuthStackParamList} from '@/navigation/AuthNavigator';
import {PENDING_PROFILE_STORAGE_KEY, PENDING_PROFILE_UPDATED_EVENT} from '@/config/variables';
import LocationService from '@/shared/services/LocationService';
import type {PlaceSuggestion} from '@/shared/services/maps/googlePlaces';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {preparePhotoPayload, isRemoteUri} from '@/features/account/utils/profilePhoto';
import {
  requestParentProfileUploadUrl,
  uploadFileToPresignedUrl,
} from '@/shared/services/uploadService';

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
    hasRemoteProfile,
    existingParentProfile,
    showOtpSuccess = false,
  } = route.params;

  const fallbackBirthDate = initialAttributes?.dateOfBirth ?? existingParentProfile?.birthDate ?? null;
  const maybeParsedDate = fallbackBirthDate ? new Date(fallbackBirthDate) : null;
  const parsedDateOfBirth =
    maybeParsedDate && !Number.isNaN(maybeParsedDate.getTime())
      ? maybeParsedDate
      : null;
  const rawPhoneSource = (initialAttributes?.phone ?? existingParentProfile?.phoneNumber ?? '').trim();
  const rawPhone = rawPhoneSource.replaceAll(/[^0-9+]/g, '');
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
  const [isOtpSuccessVisible, setIsOtpSuccessVisible] =
    useState(showOtpSuccess);

  const defaultFirstName = initialAttributes?.firstName ?? existingParentProfile?.firstName ?? '';
  const defaultLastName = initialAttributes?.lastName ?? existingParentProfile?.lastName ?? '';
  const defaultProfileImage =
    initialAttributes?.profilePicture ?? existingParentProfile?.profileImageUrl ?? null;

  const defaultAddressValues = {
    address: initialAttributes?.address?.addressLine ?? existingParentProfile?.address?.addressLine ?? '',
    stateProvince:
      initialAttributes?.address?.stateProvince ?? existingParentProfile?.address?.state ?? '',
    city: initialAttributes?.address?.city ?? existingParentProfile?.address?.city ?? '',
    postalCode:
      initialAttributes?.address?.postalCode ?? existingParentProfile?.address?.postalCode ?? '',
    country: initialAttributes?.address?.country ?? existingParentProfile?.address?.country ?? '',
  };

  const [step1Data, setStep1Data] = useState({
    firstName: defaultFirstName,
    lastName: defaultLastName,
    mobileNumber: localPhoneNumber,
    dateOfBirth: parsedDateOfBirth,
    profileImage: defaultProfileImage,
  });

  const [step2Data, setStep2Data] = useState({
    address: defaultAddressValues.address,
    stateProvince: defaultAddressValues.stateProvince,
    city: defaultAddressValues.city,
    postalCode: defaultAddressValues.postalCode,
    country: defaultAddressValues.country,
    acceptTerms: false,
  });

  // Track which bottom sheet is open
  const [openBottomSheet, setOpenBottomSheet] = useState<'countryMobile' | 'success' | null>(null);

  const {
    setQuery: setAddressQuery,
    suggestions: addressSuggestions,
    isFetching: isFetchingAddressSuggestions,
    error: addressLookupError,
    clearSuggestions: clearAddressSuggestions,
    selectSuggestion: selectAddressSuggestion,
    resetError: resetAddressError,
  } = useAddressAutocomplete({location});

  const {
    control,
    handleSubmit,
    register,
    formState: {errors},
    trigger,
    setValue,
    setError,
    clearErrors,
  } = useForm<FormData>({
    defaultValues: {
      firstName: defaultFirstName,
      lastName: defaultLastName,
      countryDialCode: resolvedCountry.dial_code,
      mobileNumber: localPhoneNumber,
      dateOfBirth: parsedDateOfBirth,
      profileImage: defaultProfileImage,
      address: defaultAddressValues.address,
      stateProvince: defaultAddressValues.stateProvince,
      city: defaultAddressValues.city,
      postalCode: defaultAddressValues.postalCode,
      country: defaultAddressValues.country,
      acceptTerms: false,
    },
    mode: 'onChange',
  });

  useEffect(() => {
    register('address', {
      validate: value => {
        if (!value) {
          return true;
        }
        if (value.length < 5) {
          return 'Address must be at least 5 characters';
        }
        return true;
      },
    });
    register('stateProvince', {
      validate: value => {
        if (!value) {
          return true;
        }
        return /^[A-Za-z\s]+$/.test(value)
          ? true
          : 'State/Province can only contain letters and spaces';
      },
    });
    register('city', {
      validate: value => {
        if (!value) {
          return true;
        }
        return /^[A-Za-z\s]+$/.test(value)
          ? true
          : 'City can only contain letters and spaces';
      },
    });
    register('postalCode', {
      validate: value => {
        if (!value) {
          return true;
        }
        return /^[A-Za-z0-9\s-]{4,10}$/.test(value)
          ? true
          : 'Please enter a valid postal code';
      },
    });
    register('country', {
      validate: value => {
        if (!value) {
          return true;
        }
        return /^[A-Za-z\s]+$/.test(value)
          ? true
          : 'Country can only contain letters and spaces';
      },
    });
  }, [register]);

  // Handle Android back button for bottom sheets
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // If date picker is open, close it first
      if (showDatePicker) {
        setShowDatePicker(false);
        return true;
      }

      // If any bottom sheet is open, close it first
      if (openBottomSheet) {
        switch (openBottomSheet) {
          case 'countryMobile':
            countryMobileRef.current?.close();
            break;
          case 'success':
            successBottomSheetRef.current?.close();
            break;
        }
        setOpenBottomSheet(null);
        return true;
      }

      return false;
    });

    return () => backHandler.remove();
  }, [showDatePicker, openBottomSheet]);

  useEffect(() => {
    let isMounted = true;

    const fetchLocation = async () => {
      try {
        const coords = await LocationService.getLocationWithRetry();
        if (coords && isMounted) {
          setLocation({latitude: coords.latitude, longitude: coords.longitude});
        }
      } catch (error) {
        console.warn('Unable to fetch location', error);
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
      setOpenBottomSheet('success');
      requestAnimationFrame(() => {
        successBottomSheetRef.current?.snapToIndex(0);
      });
    } else {
      setOpenBottomSheet(null);
      requestAnimationFrame(() => {
        successBottomSheetRef.current?.forceClose();
      });
    }
  }, [isOtpSuccessVisible]);

  const handleSuccessClose = useCallback(() => {
    setOpenBottomSheet(null);
    // Close the bottom sheet immediately, but wait to unmount it so
    // any native backdrop/overlay has time to dismiss and stop
    // intercepting touch events on Android devices.
    requestAnimationFrame(() => {
      successBottomSheetRef.current?.forceClose();
    });

    // Wait for the closing animation/native overlay teardown to finish
    // before removing the bottom sheet from the tree. This prevents a
    // lingering touch-blocking overlay on some physical Android devices.
    setTimeout(() => {
      setIsOtpSuccessVisible(false);
      navigation.setParams({showOtpSuccess: false});
    }, 400);
  }, [navigation]);

  const handleProfileImageChange = useCallback(
    (imageUri: string | null) => {
      setStep1Data(prev => ({...prev, profileImage: imageUri}));
      setValue('profileImage', imageUri, {shouldValidate: true});
    },
    [setValue],
  );

  const handleCountryMobilePress = useCallback(() => {
    setOpenBottomSheet('countryMobile');
    countryMobileRef.current?.open();
  }, []);

  const handleCountryMobileSave = useCallback(
    (country: Country, mobile: string) => {
      setSelectedCountry(country);
      setStep1Data(prev => ({...prev, mobileNumber: mobile}));
      setValue('countryDialCode', country.dial_code, {shouldValidate: true});
      setValue('mobileNumber', mobile, {shouldValidate: true});
      setOpenBottomSheet(null);
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

  const handleOpenTerms = useCallback(() => {
    navigation.navigate('TermsAndConditions');
  }, [navigation]);

  const handleOpenPrivacy = useCallback(() => {
    navigation.navigate('PrivacyPolicy');
  }, [navigation]);

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

  const handleAddressFieldChange = useCallback(
    (field: keyof AddressFieldValues, value: string) => {
      let targetField: keyof typeof step2Data;
      switch (field) {
        case 'addressLine':
          targetField = 'address';
          break;
        case 'city':
          targetField = 'city';
          break;
        case 'stateProvince':
          targetField = 'stateProvince';
          break;
        case 'postalCode':
          targetField = 'postalCode';
          break;
        case 'country':
          targetField = 'country';
          break;
        default:
          targetField = 'address';
      }
      handleStep2FieldChange(targetField, value);
      if (field === 'addressLine') {
        setAddressQuery(value);
        if (addressLookupError) {
          resetAddressError();
        }
      }
    },
    [addressLookupError, handleStep2FieldChange, resetAddressError, setAddressQuery],
  );

  const handleAddressSuggestionPress = useCallback(
    async (suggestion: PlaceSuggestion) => {
      const details = await selectAddressSuggestion(suggestion);
      if (!details) {
        return;
      }

      const addressLine = details.addressLine ?? suggestion.primaryText;
      handleStep2FieldChange('address', addressLine);

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

      resetAddressError();
      clearAddressSuggestions();
      clearErrors(['address', 'city', 'stateProvince', 'postalCode', 'country']);
    },
    [clearAddressSuggestions, clearErrors, handleStep2FieldChange, resetAddressError, selectAddressSuggestion, setLocation],
  );

  const handleNext = async () => {
    const fieldsToValidate = [
      'firstName',
      'lastName',
      'mobileNumber',
      'dateOfBirth',
    ] as const;
    const isValid = await trigger(fieldsToValidate);

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

  const submitParentProfile = useCallback(
    async (payload: ParentProfileUpsertPayload) => {
      if (!tokens.accessToken) {
        throw new Error('Authentication expired. Please sign in again.');
      }

      const parentId = existingParentProfile?.id ?? payload.parentId ?? undefined;
      const hasExistingParent = hasRemoteProfile || Boolean(existingParentProfile);
      const executor = hasExistingParent ? updateParentProfile : createParentProfile;

      return executor(
        {
          ...payload,
          parentId,
        },
        tokens.accessToken,
      );
    },
    [existingParentProfile, hasRemoteProfile, tokens.accessToken],
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

    try {
      setIsSubmitting(true);

      const birthDateIso = combinedData.dateOfBirth?.toISOString().split('T')[0] ?? null;
      const hasAddressDetails = [
        combinedData.address,
        combinedData.stateProvince,
        combinedData.city,
        combinedData.postalCode,
        combinedData.country,
      ].some(value => Boolean(value?.trim()));

      let profileImageKey: string | null = null;
      let existingPhotoUrl = combinedData.profileImage ?? profileToken ?? existingParentProfile?.profileImageUrl ?? null;

      if (combinedData.profileImage && !isRemoteUri(combinedData.profileImage)) {
        const photoPayload = await preparePhotoPayload({
          imageUri: combinedData.profileImage,
          existingRemoteUrl: profileToken ?? existingParentProfile?.profileImageUrl ?? null,
        });

        existingPhotoUrl = photoPayload.remoteUrl ?? null;

        if (photoPayload.localFile) {
          if (!tokens.accessToken) {
            throw new Error('Authentication expired. Please sign in again.');
          }

          const presigned = await requestParentProfileUploadUrl({
            accessToken: tokens.accessToken,
            mimeType: photoPayload.localFile.mimeType,
          });

          await uploadFileToPresignedUrl({
            filePath: photoPayload.localFile.path,
            mimeType: photoPayload.localFile.mimeType,
            url: presigned.url,
          });

          profileImageKey = presigned.key;
          existingPhotoUrl = null;
        }
      }

      const addressPayload = hasAddressDetails
        ? {
            addressLine: combinedData.address?.trim(),
            stateProvince: combinedData.stateProvince?.trim(),
            city: combinedData.city?.trim(),
            postalCode: combinedData.postalCode?.trim(),
            country: combinedData.country?.trim(),
            latitude: location?.latitude,
            longitude: location?.longitude,
          }
        : undefined;

      const parentPayload: ParentProfileUpsertPayload = {
        parentId: existingParentProfile?.id ?? null,
        firstName: combinedData.firstName.trim(),
        lastName: combinedData.lastName?.trim(),
        phoneNumber: combinedData.fullMobileNumber,
        email,
        dateOfBirth: birthDateIso,
        address: addressPayload,
        profileImageKey,
        existingPhotoUrl,
      };

      const parentSummary = await submitParentProfile(parentPayload);

      await AsyncStorage.removeItem(PENDING_PROFILE_STORAGE_KEY);
      DeviceEventEmitter.emit(PENDING_PROFILE_UPDATED_EVENT);

      const userPayload: User = mergeUserWithParentProfile(
        {
          id: userId,
          parentId: parentSummary.id ?? existingParentProfile?.id ?? null,
          email,
          firstName: combinedData.firstName,
          lastName: combinedData.lastName,
          phone: combinedData.fullMobileNumber,
          dateOfBirth: birthDateIso ?? undefined,
          profilePicture: combinedData.profileImage ?? undefined,
          profileToken: parentSummary.profileImageUrl ?? profileToken,
          address: addressPayload
            ? {
                addressLine: addressPayload.addressLine ?? undefined,
                stateProvince: addressPayload.stateProvince ?? undefined,
                city: addressPayload.city ?? undefined,
                postalCode: addressPayload.postalCode ?? undefined,
                country: addressPayload.country ?? undefined,
              }
            : undefined,
        },
        parentSummary,
      );

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
              value: /^\d{6,12}$/,
              message: 'Please enter a valid mobile number (6-12 digits)',
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
          rules={{
            validate: value => {
              if (!value) {
                return true;
              }
              const birthDate = new Date(value);
              if (Number.isNaN(birthDate.getTime())) {
                return 'Please select a valid date';
              }
              const maxDate = getMaximumDate();
              if (birthDate > maxDate) {
                return 'You must be at least 18 years old';
              }
              return true;
            },
          }}
          render={() => (
            <TouchableInput
              label="Date of birth (optional)"
              value={
                step1Data.dateOfBirth
                  ? formatDateForDisplay(step1Data.dateOfBirth)
                  : ''
              }
              placeholder="Select date of birth (Optional)"
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

  const renderStep2 = () => {
    const addressValues: AddressFieldValues = {
      addressLine: step2Data.address,
      city: step2Data.city,
      stateProvince: step2Data.stateProvince,
      postalCode: step2Data.postalCode,
      country: step2Data.country,
    };

    const addressFieldErrors: Partial<Record<keyof AddressFieldValues, string | undefined>> = {
      addressLine: errors.address?.message,
      city: errors.city?.message,
      stateProvince: errors.stateProvince?.message,
      postalCode: errors.postalCode?.message,
      country: errors.country?.message,
    };

    return (
      <>
      <ProfileImagePicker
        imageUri={step1Data.profileImage}
        onImageSelected={handleProfileImageChange}
      />

      <View style={styles.formSection}>
        <AddressFields
          values={addressValues}
          onChange={handleAddressFieldChange}
          addressSuggestions={addressSuggestions}
          isFetchingSuggestions={isFetchingAddressSuggestions}
          error={addressLookupError}
          onSelectSuggestion={handleAddressSuggestionPress}
          fieldErrors={addressFieldErrors}
          labels={{
            addressLine: 'Address (optional)',
            stateProvince: Platform.select({ios: 'State (optional)', default: 'State/Province (optional)'}) ?? 'State/Province (optional)',
            city: 'City (optional)',
            postalCode: 'Postal code (optional)',
            country: 'Country (optional)',
          }}
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
              <TouchableOpacity onPress={handleOpenTerms}>
                <Text style={styles.linkText}>terms and conditions</Text>
              </TouchableOpacity>
              <Text style={styles.checkboxText}> and </Text>
              <TouchableOpacity onPress={handleOpenPrivacy}>
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
  };

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
      {isOtpSuccessVisible && (
        <View style={styles.bottomSheetContainer}>
          <CustomBottomSheet
            ref={successBottomSheetRef}
            snapPoints={['35%', '50%']}
            initialIndex={1}
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
      )}
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
    ...createFormScreenStyles(theme),
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
