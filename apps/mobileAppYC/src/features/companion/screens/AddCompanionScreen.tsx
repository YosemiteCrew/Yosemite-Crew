/* istanbul ignore file -- complex native picker workflow exercised through manual QA */
// src/screens/companion/AddCompanionScreen.tsx
import React, {useState, useCallback, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity,
  BackHandler,
  type KeyboardTypeOptions,
} from 'react-native';
import {DiscardChangesBottomSheet} from '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';
import {useForm, Controller, type ControllerProps} from 'react-hook-form';
import {SafeArea, Input, Header} from '@/shared/components/common';
import {ProfileImagePicker} from '@/shared/components/common/ProfileImagePicker/ProfileImagePicker';
import {TileSelector} from '@/shared/components/common/TileSelector/TileSelector';
import {
  SimpleDatePicker,
  formatDateForDisplay,
} from '@/shared/components/common/SimpleDatePicker/SimpleDatePicker';
import {TouchableInput} from '@/shared/components/common/TouchableInput/TouchableInput';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {
  BreedBottomSheet,
  type BreedBottomSheetRef,
} from '@/shared/components/common/BreedBottomSheet/BreedBottomSheet';
import {
  BloodGroupBottomSheet,
  type BloodGroupBottomSheetRef,
} from '@/shared/components/common/BloodGroupBottomSheet/BloodGroupBottomSheet';

import {
  CountryBottomSheet,
  type CountryBottomSheetRef,
} from '@/shared/components/common/CountryBottomSheet/CountryBottomSheet';

import {useTheme} from '@/hooks';
import {createFormScreenStyles} from '@/shared/utils/formScreenStyles';
import {Images} from '@/assets/images';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {HomeStackParamList} from '@/navigation/types';
import COUNTRIES from '@/shared/utils/countryList.json';
import CAT_BREEDS from '@/features/companion/data/catBreeds.json';
import DOG_BREEDS from '@/features/companion/data/dogBreeds.json';
import HORSE_BREEDS from '@/features/companion/data/horseBreeds.json';
import type {
  CompanionCategory,
  CompanionGender,
  NeuteredStatus,
  InsuredStatus,
  CompanionOrigin,
  Breed,
} from '@/features/companion/types';
import {useDispatch} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {addCompanion} from '@/features/companion';
import {useAuth} from '@/features/auth/context/AuthContext';
import {usePreferences} from '@/features/preferences/PreferencesContext';
import {convertWeight} from '@/shared/utils/measurementSystem';

type AddCompanionScreenProps = NativeStackScreenProps<
  HomeStackParamList,
  'AddCompanion'
>;

interface FormData {
  category: CompanionCategory | null;
  name: string;
  breed: Breed | null;
  dateOfBirth: Date | null;
  gender: CompanionGender | null;
  currentWeight: string;
  color: string;
  allergies: string;
  neuteredStatus: NeuteredStatus | null;
  ageWhenNeutered: string;
  bloodGroup: string | null;
  microchipNumber: string;
  passportNumber: string;
  insuredStatus: InsuredStatus | null;
  insuranceCompany: string;
  insurancePolicyNumber: string;
  countryOfOrigin: string | null;
  origin: CompanionOrigin | null;
  profileImage: string | null;
}

const COMPANION_CATEGORIES = [
  {value: 'cat', label: 'Cat'},
  {value: 'dog', label: 'Dog'},
  {value: 'horse', label: 'Horse'},
];

const GENDER_OPTIONS = [
  {value: 'male', label: 'Male'},
  {value: 'female', label: 'Female'},
];

const NEUTERED_OPTIONS = [
  {value: 'neutered', label: 'Neutered'},
  {value: 'not-neutered', label: 'Not neutered'},
];

const INSURED_OPTIONS = [
  {value: 'insured', label: 'Insured'},
  {value: 'not-insured', label: 'Not insured'},
];

const ORIGIN_OPTIONS = [
  {value: 'shop', label: 'Shop'},
  {value: 'breeder', label: 'Breeder'},
  {value: 'foster-shelter', label: 'Foster/ Shelter'},
  {value: 'friends-family', label: 'Friends or family'},
  {value: 'unknown', label: 'Unknown'},
];

export const AddCompanionScreen: React.FC<AddCompanionScreenProps> = ({
  navigation,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const dispatch = useDispatch<AppDispatch>();
  const {user} = useAuth();
  const {weightUnit} = usePreferences();

  const breedSheetRef = useRef<BreedBottomSheetRef>(null);
  const bloodGroupSheetRef = useRef<BloodGroupBottomSheetRef>(null);
  const countrySheetRef = useRef<CountryBottomSheetRef>(null);
  const discardSheetRef = useRef<any>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track which bottom sheet is currently open
  const [openBottomSheet, setOpenBottomSheet] = useState<'breed' | 'bloodGroup' | 'country' | null>(null);

  const {
    control,
    handleSubmit,
    formState: {errors},
    trigger,
    setValue,
    watch,
    setError,
    clearErrors,
  } = useForm<FormData>({
    defaultValues: {
      category: null,
      name: '',
      breed: null,
      dateOfBirth: null,
      gender: null,
      currentWeight: '',
      color: '',
      allergies: '',
      neuteredStatus: null,
      ageWhenNeutered: '',
      bloodGroup: null,
      microchipNumber: '',
      passportNumber: '',
      insuredStatus: null,
      insuranceCompany: '',
      insurancePolicyNumber: '',
      countryOfOrigin: null,
      origin: null,
      profileImage: null,
    },
    mode: 'onChange',
  });

  const getFieldError = (field: keyof FormData) => errors[field]?.message;

  type TextFieldKey =
    | 'name'
    | 'currentWeight'
    | 'color'
    | 'allergies'
    | 'ageWhenNeutered'
    | 'microchipNumber'
    | 'passportNumber'
    | 'insuranceCompany'
    | 'insurancePolicyNumber';

  const renderTextField = <Field extends TextFieldKey>(
    field: Field,
    {
      label,
      placeholder,
      keyboardType,
    maxLength,
    multiline,
    rules,
    suffix,
    dynamicSuffix,
  }: {
    label: string;
    placeholder?: string;
    keyboardType?: KeyboardTypeOptions;
    maxLength?: number;
    multiline?: boolean;
    rules?: ControllerProps<FormData, Field>['rules'];
    suffix?: string;
    dynamicSuffix?: (value: string) => string;
  },
) => (
  <Controller<FormData, Field>
    control={control}
    name={field}
    rules={rules}
    render={({field: {onChange, value}}) => {
      let textValue = '';
      if (typeof value === 'string' || typeof value === 'number') {
        textValue = String(value ?? '');
      }

      const displaySuffix = dynamicSuffix ? dynamicSuffix(textValue) : suffix;

      return (
        <Input
          label={label}
          value={textValue}
          onChangeText={(text) => {
            onChange(text);
            setHasUnsavedChanges(true);
          }}
          placeholder={placeholder}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          error={getFieldError(field)}
          containerStyle={styles.inputContainer}
          icon={
            displaySuffix && textValue ? (
              <Text style={styles.suffixText}>{displaySuffix}</Text>
            ) : undefined
          }
        />
      );
    }}
  />
);

  const category = watch('category');
  const neuteredStatus = watch('neuteredStatus');
  const insuredStatus = watch('insuredStatus');
  const breed = watch('breed');
  const bloodGroup = watch('bloodGroup');
  const countryOfOrigin = watch('countryOfOrigin');
  const dateOfBirth = watch('dateOfBirth');
  const profileImage = watch('profileImage');

// eslint-disable-next-line @typescript-eslint/no-shadow
const getBreedListByCategory = (category: CompanionCategory | null): Breed[] => {
  switch (category) {
    case 'cat':
      return CAT_BREEDS as Breed[];
    case 'dog':
      return DOG_BREEDS as Breed[];
    case 'horse':
      return HORSE_BREEDS as Breed[];
    default:
      return []; // ✅ Fix: return an empty array
  }
};



  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // If date picker is open, close it first
      if (showDatePicker) {
        setShowDatePicker(false);
        return true; // Prevent default back action
      }

      // If any bottom sheet is open, close it first
      if (openBottomSheet) {
        switch (openBottomSheet) {
          case 'breed':
            breedSheetRef.current?.close();
            break;
          case 'bloodGroup':
            bloodGroupSheetRef.current?.close();
            break;
          case 'country':
            countrySheetRef.current?.close();
            break;
        }
        setOpenBottomSheet(null);
        return true; // Prevent default back action
      }

      // Otherwise allow normal back navigation
      return false;
    });

    return () => backHandler.remove();
  }, [showDatePicker, openBottomSheet]);

  const handleGoBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else if (hasUnsavedChanges) {
      discardSheetRef.current?.open();
    } else {
      navigation.goBack();
    }
  }, [currentStep, navigation, hasUnsavedChanges]);

  const handleProfileImageChange = useCallback(
    (imageUri: string | null) => {
      setValue('profileImage', imageUri, {shouldValidate: true});
      setHasUnsavedChanges(true);
    },
    [setValue],
  );

  const handleBreedPress = useCallback(() => {
    setOpenBottomSheet('breed');
    breedSheetRef.current?.open();
  }, []);

  const handleBreedSave = useCallback(
    (selectedBreed: Breed | null) => {
      setValue('breed', selectedBreed, {shouldValidate: true});
      setOpenBottomSheet(null);
      setHasUnsavedChanges(true);
    },
    [setValue],
  );

  const handleBloodGroupPress = useCallback(() => {
    setOpenBottomSheet('bloodGroup');
    bloodGroupSheetRef.current?.open();
  }, []);

  const handleBloodGroupSave = useCallback(
    (selectedBloodGroup: string | null) => {
      setValue('bloodGroup', selectedBloodGroup, {shouldValidate: true});
      setOpenBottomSheet(null);
      setHasUnsavedChanges(true);
    },
    [setValue],
  );

  const handleCountryPress = useCallback(() => {
    setOpenBottomSheet('country');
    countrySheetRef.current?.open();
  }, []);

  const handleCountrySave = useCallback(
    (country: any) => {
      setValue('countryOfOrigin', country?.name || null, {shouldValidate: true});
      setOpenBottomSheet(null);
      setHasUnsavedChanges(true);
    },
    [setValue],
  );

  const handleDatePickerPress = useCallback(() => {
    setShowDatePicker(true);
  }, []);

  const handleDateChange = useCallback(
    (date: Date) => {
      setValue('dateOfBirth', date, {shouldValidate: true});
      setShowDatePicker(false);
      setHasUnsavedChanges(true);
    },
    [setValue],
  );

  const handleDatePickerDismiss = useCallback(() => {
    setShowDatePicker(false);
  }, []);

  const getMaximumDate = useCallback(() => {
    return new Date();
  }, []);

  const handleStep1Next = async () => {
    const isValid = await trigger(['category']);

    if (!category) {
      setError('category', {
        type: 'manual',
        message: 'Please select a companion category',
      });
      return;
    }

    if (isValid) {
      clearErrors('category');
      setCurrentStep(2);
    }
  };

  const handleStep2Next = async () => {
    const fieldsToValidate = ['name', 'gender', 'dateOfBirth'] as const;
    const isValid = await trigger(fieldsToValidate);

    if (!dateOfBirth) {
      setError('dateOfBirth', {
        type: 'manual',
        message: 'Date of birth is required',
      });
      return;
    }

    if (isValid) {
      clearErrors('dateOfBirth');
      setCurrentStep(3);
    }
  };

  const handleSave = handleSubmit(async data => {
    console.log('=== Form Submission Started ===');
    console.log('Form Data:', JSON.stringify(data, null, 2));

    if (!user?.parentId) {
      setSubmissionError('Parent profile not found. Please complete your profile.');
      console.error('Parent profile missing for companion creation');
      return;
    }

    if (
      !data.category ||
      !data.gender ||
      !data.neuteredStatus ||
      !data.insuredStatus ||
      !data.origin
    ) {
      setSubmissionError('Please fill in all required fields');
      console.error('Missing required fields:', {
        category: data.category,
        gender: data.gender,
        neuteredStatus: data.neuteredStatus,
        insuredStatus: data.insuredStatus,
        origin: data.origin,
      });
      return;
    }

    setSubmissionError('');

    // Convert weight to kg (standard storage unit) if user entered in lbs
    let weightInKg = data.currentWeight ? Number.parseFloat(data.currentWeight) : null;
    if (weightInKg && weightUnit === 'lbs') {
      weightInKg = convertWeight(weightInKg, 'lbs', 'kg');
    }

    const companionPayload = {
      category: data.category,
      name: data.name,
      breed: data.breed,
      dateOfBirth: data.dateOfBirth?.toISOString() ?? null,
      gender: data.gender,
      currentWeight: weightInKg,
      color: data.color || null,
      allergies: data.allergies || null,
      neuteredStatus: data.neuteredStatus,
      ageWhenNeutered: data.ageWhenNeutered || null,
      bloodGroup: data.bloodGroup,
      microchipNumber: data.microchipNumber || null,
      passportNumber: data.passportNumber || null,
      insuredStatus: data.insuredStatus,
      insuranceCompany: data.insuranceCompany || null,
      insurancePolicyNumber: data.insurancePolicyNumber || null,
      countryOfOrigin: data.countryOfOrigin,
      origin: data.origin,
      profileImage: data.profileImage,
    };

    console.log(
      'Companion Payload:',
      JSON.stringify(companionPayload, null, 2),
    );

    try {
      setIsSubmitting(true);

      const result = await dispatch(
        addCompanion({
          parentId: user.parentId,
          payload: companionPayload,
        }),
      ).unwrap();

      console.log('Companion added successfully:', result);
      navigation.popToTop();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while adding your companion. Please try again.';
      setSubmissionError(message);
      console.error('Add companion error:', error);
    } finally {
      setIsSubmitting(false);
    }
  });

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>
        Select your companions to begin managing their health profile
      </Text>

      <View style={styles.categoryGrid}>
        {COMPANION_CATEGORIES.map(cat => {
          const isSelected = category === cat.value;
          const imageSources: Record<string, any> = {
            cat: Images.cat,
            dog: Images.dog,
            horse: Images.horse,
          };

          return (
            <TouchableOpacity
              key={cat.value}
              style={[
                styles.categoryCard,
                isSelected && styles.categoryCardSelected,
              ]}
              onPress={() => {
                setValue('category', cat.value as CompanionCategory, {
                  shouldValidate: true,
                });
                clearErrors('category');
                setHasUnsavedChanges(true);
              }}
              activeOpacity={0.8}>
              <Image
                source={imageSources[cat.value]}
                style={[
                  styles.categoryIcon
                ]}
              />
              <Text
                style={[
                  styles.categoryLabel,
                  isSelected && styles.categoryLabelSelected,
                ]}>
                {cat.label}
              </Text>
              {isSelected && <View style={styles.categoryUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {errors.category?.message && (
        <Text style={styles.errorText}>{errors.category.message}</Text>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <ProfileImagePicker
        imageUri={profileImage}
        onImageSelected={handleProfileImageChange}
      />

      <View style={styles.formSection}>
        {renderTextField('name', {
          label: 'Name',
          maxLength: 50,
          rules: {
            required: 'Name is required',
            minLength: {
              value: 2,
              message: 'Name must be at least 2 characters',
            },
          },
        })}

        <Controller
          control={control}
          name="breed"
          render={() => (
            <TouchableInput
              label="Breed"
              value={breed?.breedName ?? ''}
              placeholder="Select breed"
              onPress={handleBreedPress}
              error={errors.breed?.message}
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
              value={dateOfBirth ? formatDateForDisplay(dateOfBirth) : ''}
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

        <View style={styles.fieldGroup}>
          <Controller
            control={control}
            name="gender"
            rules={{required: 'Gender is required'}}
            render={() => (
              <TileSelector
                options={GENDER_OPTIONS}
                selectedValue={watch('gender')}
                onSelect={value => {
                  setValue('gender', value as CompanionGender, {
                    shouldValidate: true,
                  });
                  setHasUnsavedChanges(true);
                }}
              />
            )}
          />
          {errors.gender?.message && (
            <Text style={styles.errorText}>{errors.gender.message}</Text>
          )}
        </View>

        {renderTextField('currentWeight', {
          label: 'Current weight (optional)',
          placeholder: weightUnit,
          keyboardType: 'decimal-pad',
          suffix: weightUnit,
        })}

        {renderTextField('color', {
          label: 'Colour (optional)',
          maxLength: 50,
        })}

        {renderTextField('allergies', {
          label: 'Allergies (optional)',
          maxLength: 200,
          multiline: true,
        })}

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Neutered status</Text>
          <Controller
            control={control}
            name="neuteredStatus"
            rules={{required: 'Neutered status is required'}}
            render={() => (
              <TileSelector
                options={NEUTERED_OPTIONS}
                selectedValue={neuteredStatus}
                onSelect={value => {
                  setValue('neuteredStatus', value as NeuteredStatus, {
                    shouldValidate: true,
                  });
                  setHasUnsavedChanges(true);
                }}
              />
            )}
          />
          {errors.neuteredStatus?.message && (
            <Text style={styles.errorText}>
              {errors.neuteredStatus.message}
            </Text>
          )}
        </View>

        {neuteredStatus === 'neutered' &&
          renderTextField('ageWhenNeutered', {
            label: 'Age when neutered',
            placeholder: 'e.g., 1 Year',
            maxLength: 20,
            dynamicSuffix: (value) => {
              const numValue = Number.parseFloat(value);
              if (Number.isNaN(numValue)) return '';
              return numValue === 1 ? 'Year' : 'Years';
            },
          })}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <ProfileImagePicker
        imageUri={profileImage}
        onImageSelected={handleProfileImageChange}
      />

      <View style={styles.formSection}>
        <Controller
          control={control}
          name="bloodGroup"
          render={() => (
            <TouchableInput
              label="Blood group (optional)"
              value={bloodGroup ?? ''}
              placeholder="Select blood group"
              onPress={handleBloodGroupPress}
              error={errors.bloodGroup?.message}
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

        {renderTextField('microchipNumber', {
          label: 'Microchip number (optional)',
          maxLength: 50,
        })}

        {renderTextField('passportNumber', {
          label: 'Passport number (optional)',
          maxLength: 50,
        })}

        <View style={styles.fieldGroup}>
          <Controller
            control={control}
            name="insuredStatus"
            rules={{required: 'Insurance status is required'}}
            render={() => (
              <TileSelector
                options={INSURED_OPTIONS}
                selectedValue={insuredStatus}
                onSelect={value => {
                  setValue('insuredStatus', value as InsuredStatus, {
                    shouldValidate: true,
                  });
                  setHasUnsavedChanges(true);
                }}
              />
            )}
          />
          {errors.insuredStatus?.message && (
            <Text style={styles.errorText}>{errors.insuredStatus.message}</Text>
          )}
        </View>

        {insuredStatus === 'insured' && (
          <React.Fragment key="insurance-fields">
            {renderTextField('insuranceCompany', {
              label: 'Insurance company (optional)',
              maxLength: 100,
            })}

            {renderTextField('insurancePolicyNumber', {
              label: 'Insurance policy number',
              placeholder: 'Insurance policy number',
              maxLength: 50,
            })}
          </React.Fragment>
        )}

        <Controller
          control={control}
          name="countryOfOrigin"
          render={() => (
            <TouchableInput
              label="Country of origin (optional)"
              value={countryOfOrigin ?? ''}
              placeholder="Select country of origin"
              onPress={handleCountryPress}
              error={errors.countryOfOrigin?.message}
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

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>My pet comes from:</Text>
          <Controller
            control={control}
            name="origin"
            rules={{required: 'Origin is required'}}
            render={() => (
              <TileSelector
                options={ORIGIN_OPTIONS}
                selectedValue={watch('origin')}
                onSelect={value => {
                  setValue('origin', value as CompanionOrigin, {
                    shouldValidate: true,
                  });
                  setHasUnsavedChanges(true);
                }}
              />
            )}
          />
          {errors.origin?.message && (
            <Text style={styles.errorText}>{errors.origin.message}</Text>
          )}
        </View>
      </View>
    </View>
  );

  const isStepOne = currentStep === 1;
  const isStepTwo = currentStep === 2;
  const isFinalStep = currentStep === 3;

  const primaryButtonLabel = (() => {
    if (isStepOne || isStepTwo) {
      return 'Next';
    }
    if (isSubmitting) {
      return 'Saving...';
    }
    return 'Save';
  })();

  const handlePrimaryButtonPress = () => {
    if (isStepOne) {
      handleStep1Next().catch(error => {
        console.warn('Failed to progress from step 1', error);
      });
      return;
    }
    if (isStepTwo) {
      handleStep2Next().catch(error => {
        console.warn('Failed to progress from step 2', error);
      });
      return;
    }
    handleSave().catch(error => {
      console.warn('Failed to save companion', error);
    });
  };

  const isPrimaryButtonLoading = isFinalStep && isSubmitting;

  return (
    <SafeArea style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}>
        <Header
          title={currentStep === 1 ? 'Choose your companion' : 'Add companion'}
          showBackButton
          onBack={handleGoBack}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </ScrollView>

        {submissionError ? (
          <Text style={styles.submissionError}>{submissionError}</Text>
        ) : null}

        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title={primaryButtonLabel}
            onPress={handlePrimaryButtonPress}
            style={styles.button}
            textStyle={styles.buttonText}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            forceBorder
            borderColor="rgba(255, 255, 255, 0.35)"
            height={56}
            borderRadius={16}
            loading={isPrimaryButtonLoading}
            disabled={isPrimaryButtonLoading}
          />
        </View>

        <SimpleDatePicker
          value={dateOfBirth}
          onDateChange={handleDateChange}
          show={showDatePicker}
          onDismiss={handleDatePickerDismiss}
          maximumDate={getMaximumDate()}
          mode="date"
        />
      </KeyboardAvoidingView>

      <BreedBottomSheet
        ref={breedSheetRef}
        breeds={getBreedListByCategory(category)}
        selectedBreed={breed}
        onSave={handleBreedSave}
      />


      <BloodGroupBottomSheet
        ref={bloodGroupSheetRef}
        selectedBloodGroup={bloodGroup}
        category={category}
        onSave={handleBloodGroupSave}
      />

      <CountryBottomSheet // <-- NEW COMPONENT NAME
        ref={countrySheetRef}
        countries={COUNTRIES}
        selectedCountry={
          COUNTRIES.find(c => c.name === countryOfOrigin) ?? null // Use null if no country is selected
        }
        onSave={country => handleCountrySave(country)}
      />

      <DiscardChangesBottomSheet
        ref={discardSheetRef}
        onDiscard={() => navigation.goBack()}
      />
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    ...createFormScreenStyles(theme),
    stepContainer: {
      flex: 1,
    },
    stepTitle: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing['30'],
           marginTop: theme.spacing['6'],
      lineHeight: 22,
    },
    categoryGrid: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: theme.spacing['6'],
      marginBottom: theme.spacing['4'],
    },
    categoryCard: {
      alignItems: 'center',
      gap: theme.spacing['3'],
      paddingVertical: theme.spacing['4'],
    },
    categoryCardSelected: {},
    categoryIcon: {
      width: 110,
      height: 110,
      objectFit:"contain",
      padding: theme.spacing['4'],

    },
    categoryLabel: {
      ...theme.typography.titleLarge,
      color: theme.colors.text,
      fontWeight: '500',
    },
    categoryLabelSelected: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    categoryUnderline: {
      width: '100%',
      height: 3,
      backgroundColor: theme.colors.primary,
      borderRadius: 2,
      marginTop: theme.spacing['1'],
    },
    suffixText: {
      ...theme.typography.input,
      color: theme.colors.textSecondary,
      fontSize: 16,
      marginLeft: theme.spacing['2'],
    },
  });
