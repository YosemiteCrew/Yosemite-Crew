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
  BackHandler,
  type KeyboardTypeOptions,
} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {DiscardChangesBottomSheet} from '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';
import {useForm, Controller, type ControllerProps} from 'react-hook-form';
import {SafeArea, Input, Header} from '@/shared/components/common';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {ProfileImagePicker} from '@/shared/components/common/ProfileImagePicker/ProfileImagePicker';
import {TileSelector} from '@/shared/components/common/TileSelector/TileSelector';
import {SimpleDatePicker} from '@/shared/components/common/SimpleDatePicker/SimpleDatePicker';
import {formatDateForDisplay} from '@/shared/components/common/SimpleDatePicker/dateTimeFormat';
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
import {createLiquidGlassHeaderStyles} from '@/shared/utils/screenStyles';
import {Images} from '@/assets/images';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {HomeStackParamList} from '@/navigation/types';
import COUNTRIES from '@/shared/utils/countryList.json';
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
import {getFreshStoredTokens} from '@/features/auth/sessionManager';
import {
  fetchBreedCodeEntries,
  fetchSpeciesCodeEntries,
  type BreedCodeEntry,
  type SpeciesCodeEntry,
} from '@/features/companion/services/codeEntriesService';

type AddCompanionScreenProps = NativeStackScreenProps<
  HomeStackParamList,
  'AddCompanion'
>;

interface FormData {
  category: CompanionCategory | null;
  speciesCode: string | null;
  name: string;
  breed: Breed | null;
  breedCode: string | null;
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
  {value: 'dog', label: 'Dog', subtitle: 'Canine · all breeds'},
  {value: 'cat', label: 'Cat', subtitle: 'Feline · all breeds'},
  {value: 'horse', label: 'Horse', subtitle: 'Equine · all breeds'},
];

const TOTAL_STEPS = 3;

const CATEGORY_TO_SPECIES_QUERY: Record<CompanionCategory, string> = {
  dog: 'canine',
  cat: 'feline',
  horse: 'equine',
};

const CATEGORY_TO_SPECIES_LABEL: Record<CompanionCategory, string> = {
  dog: 'Dog',
  cat: 'Cat',
  horse: 'Horse',
};

const GENDER_OPTIONS = [
  {value: 'male', label: 'Male'},
  {value: 'female', label: 'Female'},
];

const getNeuteredOptions = (gender?: string | null) => {
  const term = gender === 'female' ? 'Spayed' : 'Neutered';
  return [
    {value: 'neutered', label: term},
    {value: 'not-neutered', label: `Not ${term.toLowerCase()}`},
  ];
};

const INSURED_OPTIONS = [
  {value: 'insured', label: 'Insured'},
  {value: 'not-insured', label: 'Not insured'},
];

const ORIGIN_OPTIONS = [
  {value: 'shop', label: 'Shop'},
  {value: 'breeder', label: 'Breeder'},
  {value: 'foster-shelter', label: 'Foster/ Shelter'},
  {value: 'friends-family', label: 'Friends or family'},
  {value: 'stray', label: 'Stray'},
  {value: 'unknown', label: 'Unknown'},
];

export const AddCompanionScreen: React.FC<AddCompanionScreenProps> = ({
  navigation,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = React.useState(0);
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
  const hasUnsavedChangesRef = useRef(false);
  const speciesByCategoryRef = useRef<
    Partial<Record<CompanionCategory, SpeciesCodeEntry>>
  >({});
  const [breedOptions, setBreedOptions] = useState<Breed[]>([]);
  // An empty picker caused by a failed lookup used to look identical to a
  // species that genuinely has no breeds. Breed is required, so that dead end
  // blocked companion creation entirely with nothing explaining why.
  const [breedLoadFailed, setBreedLoadFailed] = useState(false);

  // Track which bottom sheet is currently open
  const openBottomSheetRef = useRef<'breed' | 'bloodGroup' | 'country' | null>(
    null,
  );

  const {
    control,
    handleSubmit,
    formState: {errors},
    trigger,
    setValue,
    getValues,
    watch,
    setError,
    clearErrors,
  } = useForm<FormData>({
    defaultValues: {
      category: null,
      speciesCode: null,
      name: '',
      breed: null,
      breedCode: null,
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
    // onTouched, not onChange: validating every keystroke told people their
    // own name "must be at least 2 characters" after the first letter. The
    // field is judged when they leave it, and only then re-checked as they
    // type, so a correction still updates live.
    mode: 'onTouched',
    reValidateMode: 'onChange',
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

  const buildTextField = <Field extends TextFieldKey>(
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
      rules?: NonNullable<ControllerProps<FormData, Field>['rules']>;
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
            onChangeText={text => {
              onChange(text);
              hasUnsavedChangesRef.current = true;
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
  const gender = watch('gender');
  const neuteredStatus = watch('neuteredStatus');
  const insuredStatus = watch('insuredStatus');
  const breed = watch('breed');
  const bloodGroup = watch('bloodGroup');
  const countryOfOrigin = watch('countryOfOrigin');
  const dateOfBirth = watch('dateOfBirth');
  const profileImage = watch('profileImage');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const tokens = await getFreshStoredTokens();
        if (!tokens?.accessToken) {
          return;
        }
        const speciesEntries = await fetchSpeciesCodeEntries(
          tokens.accessToken,
        );
        if (!mounted) {
          return;
        }

        const byCategory: Partial<Record<CompanionCategory, SpeciesCodeEntry>> =
          {};
        for (const entry of speciesEntries) {
          const normalized = entry.display?.toLowerCase().trim();
          if (normalized === 'canine') {
            byCategory.dog = entry;
          } else if (normalized === 'feline') {
            byCategory.cat = entry;
          } else if (normalized === 'equine') {
            byCategory.horse = entry;
          }
        }
        speciesByCategoryRef.current = byCategory;

        const selectedCategory = getValues('category');
        if (selectedCategory) {
          setValue('speciesCode', byCategory[selectedCategory]?.code ?? null, {
            shouldValidate: false,
          });
        }
      } catch (error) {
        console.warn('[Companion] Unable to load species code entries', error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [getValues, setValue]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!category) {
        setBreedOptions([]);
        setBreedLoadFailed(false);
        setValue('speciesCode', null, {shouldValidate: false});
        setValue('breed', null, {shouldValidate: false});
        setValue('breedCode', null, {shouldValidate: false});
        return;
      }

      setValue(
        'speciesCode',
        speciesByCategoryRef.current[category]?.code ?? null,
        {
          shouldValidate: false,
        },
      );
      setValue('breed', null, {shouldValidate: false});
      setValue('breedCode', null, {shouldValidate: false});

      try {
        const tokens = await getFreshStoredTokens();
        if (!tokens?.accessToken) {
          if (mounted) {
            setBreedLoadFailed(true);
          }
          return;
        }
        const entries = await fetchBreedCodeEntries(
          CATEGORY_TO_SPECIES_QUERY[category],
          tokens.accessToken,
        );
        if (!mounted) {
          return;
        }

        const mappedBreeds: Breed[] = entries.map(
          (entry: BreedCodeEntry, index: number) => ({
            speciesId: index + 1,
            speciesName: CATEGORY_TO_SPECIES_LABEL[category],
            breedId: index + 1,
            breedName: entry.display,
            speciesCode:
              entry.meta?.speciesCode ??
              speciesByCategoryRef.current[category]?.code,
            breedCode: entry.code,
          }),
        );
        setBreedOptions(mappedBreeds);
        setBreedLoadFailed(false);
      } catch (error) {
        setBreedOptions([]);
        setBreedLoadFailed(true);
        console.warn('[Companion] Unable to load breed code entries', error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [category, setValue]);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        // If date picker is open, close it first
        if (showDatePicker) {
          setShowDatePicker(false);
          return true; // Prevent default back action
        }

        // If any bottom sheet is open, close it first
        if (openBottomSheetRef.current) {
          switch (openBottomSheetRef.current) {
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
          openBottomSheetRef.current = null;
          return true; // Prevent default back action
        }

        // Otherwise allow normal back navigation
        return false;
      },
    );

    return () => backHandler.remove();
  }, [showDatePicker]);

  const handleGoBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else if (hasUnsavedChangesRef.current) {
      discardSheetRef.current?.open();
    } else {
      navigation.goBack();
    }
  }, [currentStep, navigation]);

  const handleProfileImageChange = useCallback(
    (imageUri: string | null) => {
      setValue('profileImage', imageUri, {shouldValidate: true});
      hasUnsavedChangesRef.current = true;
    },
    [setValue],
  );

  const handleBreedPress = useCallback(() => {
    openBottomSheetRef.current = 'breed';
    breedSheetRef.current?.open();
  }, []);

  const handleBreedSave = useCallback(
    (selectedBreed: Breed | null) => {
      setValue('breed', selectedBreed, {shouldValidate: true});
      setValue('breedCode', selectedBreed?.breedCode ?? null, {
        shouldValidate: false,
      });
      setValue(
        'speciesCode',
        selectedBreed?.speciesCode ??
          speciesByCategoryRef.current[category ?? 'dog']?.code ??
          null,
        {
          shouldValidate: false,
        },
      );
      openBottomSheetRef.current = null;
      hasUnsavedChangesRef.current = true;
    },
    [category, setValue],
  );

  const handleBloodGroupPress = useCallback(() => {
    openBottomSheetRef.current = 'bloodGroup';
    bloodGroupSheetRef.current?.open();
  }, []);

  const handleBloodGroupSave = useCallback(
    (selectedBloodGroup: string | null) => {
      setValue('bloodGroup', selectedBloodGroup, {shouldValidate: true});
      openBottomSheetRef.current = null;
      hasUnsavedChangesRef.current = true;
    },
    [setValue],
  );

  const handleCountryPress = useCallback(() => {
    openBottomSheetRef.current = 'country';
    countrySheetRef.current?.open();
  }, []);

  const handleCountrySave = useCallback(
    (country: any) => {
      setValue('countryOfOrigin', country?.name || null, {
        shouldValidate: true,
      });
      openBottomSheetRef.current = null;
      hasUnsavedChangesRef.current = true;
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
      hasUnsavedChangesRef.current = true;
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
    if (!category) {
      setError('category', {
        type: 'manual',
        message: 'Please select a companion category',
      });
      return;
    }

    const isValid = await trigger(['category']);

    if (isValid) {
      clearErrors('category');
      setCurrentStep(2);
    }
  };

  const handleStep2Next = async () => {
    const fieldsToValidate = [
      'name',
      'breed',
      'gender',
      'dateOfBirth',
      'neuteredStatus',
      'ageWhenNeutered',
    ] as const;

    if (!breed) {
      setError('breed', {
        type: 'manual',
        message: 'Breed is required',
      });
      return;
    }

    if (!dateOfBirth) {
      setError('dateOfBirth', {
        type: 'manual',
        message: 'Date of birth is required',
      });
      return;
    }

    if (!watch('neuteredStatus')) {
      setError('neuteredStatus', {
        type: 'manual',
        message: 'Neutered status is required',
      });
      return;
    }

    const isValid = await trigger(fieldsToValidate);

    if (isValid) {
      clearErrors([
        'breed',
        'dateOfBirth',
        'neuteredStatus',
        'ageWhenNeutered',
      ]);
      setCurrentStep(3);
    }
  };

  const handleSave = handleSubmit(async data => {
    console.log('=== Form Submission Started ===');

    if (!user?.parentId) {
      setSubmissionError(
        'Parent profile not found. Please complete your profile.',
      );
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

    const enteredWeight = data.currentWeight
      ? Number.parseFloat(data.currentWeight)
      : null;
    const weightInKg =
      enteredWeight === null || Number.isNaN(enteredWeight)
        ? null
        : convertWeight(enteredWeight, weightUnit, 'kg');

    const companionPayload = {
      category: data.category,
      speciesCode: data.speciesCode,
      name: data.name,
      breed: data.breed,
      breedCode: data.breedCode,
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

  const renderStepProgress = () => {
    const segments = Array.from({length: TOTAL_STEPS}, (_, i) => ({
      key: `progress-${i}`,
      filled: i < currentStep,
    }));
    return (
      <View style={styles.progressBar}>
        {segments.map(segment => (
          <View
            key={segment.key}
            style={[
              styles.progressSegment,
              segment.filled
                ? styles.progressSegmentActive
                : styles.progressSegmentIdle,
            ]}
          />
        ))}
      </View>
    );
  };

  const renderStep1 = () => {
    const imageSources: Record<string, any> = {
      cat: Images.cat,
      dog: Images.dog,
      horse: Images.horse,
    };
    const avatarStyles: Record<string, any> = {
      dog: styles.speciesAvatarAmber,
      cat: styles.speciesAvatarViolet,
      horse: styles.speciesAvatarGreen,
    };

    return (
      <View style={styles.stepContainer}>
        {renderStepProgress()}

        <View style={styles.introBlock}>
          <Text style={styles.introTitle}>Who joins the family?</Text>
          <Text style={styles.introSubtitle}>
            Pick a species to start their record. You can add more companions
            later.
          </Text>
        </View>

        <View style={styles.speciesList}>
          {COMPANION_CATEGORIES.map(cat => {
            const isSelected = category === cat.value;

            return (
              <PressableOpacity
                key={cat.value}
                style={[
                  styles.speciesCard,
                  isSelected && styles.speciesCardSelected,
                ]}
                onPress={() => {
                  setValue('category', cat.value as CompanionCategory, {
                    shouldValidate: true,
                  });
                  clearErrors('category');
                  hasUnsavedChangesRef.current = true;
                }}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{selected: isSelected}}
                accessibilityLabel={`${cat.label}, ${cat.subtitle}`}>
                <View style={[styles.speciesAvatar, avatarStyles[cat.value]]}>
                  <Image
                    source={imageSources[cat.value]}
                    style={styles.speciesImage}
                  />
                </View>
                <View style={styles.speciesTextBlock}>
                  <Text style={styles.speciesName}>{cat.label}</Text>
                  <Text style={styles.speciesSubtitle}>{cat.subtitle}</Text>
                </View>
                {isSelected && (
                  <View style={styles.speciesCheck}>
                    <Text style={styles.speciesCheckText}>✓</Text>
                  </View>
                )}
              </PressableOpacity>
            );
          })}
        </View>

        {errors.category?.message && (
          <Text style={styles.errorText}>{errors.category.message}</Text>
        )}
      </View>
    );
  };

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      {renderStepProgress()}

      <ProfileImagePicker
        imageUri={profileImage}
        onImageSelected={handleProfileImageChange}
      />

      <View style={styles.formSection}>
        {buildTextField('name', {
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
          rules={{required: 'Breed is required'}}
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
                  hasUnsavedChangesRef.current = true;
                }}
              />
            )}
          />
          {errors.gender?.message && (
            <Text style={styles.errorText}>{errors.gender.message}</Text>
          )}
        </View>

        {buildTextField('currentWeight', {
          label: 'Current weight (optional)',
          placeholder: weightUnit,
          keyboardType: 'decimal-pad',
          suffix: weightUnit,
        })}

        {buildTextField('color', {
          label: 'Colour (optional)',
          maxLength: 50,
        })}

        {buildTextField('allergies', {
          label: 'Allergies (optional)',
          maxLength: 200,
          multiline: true,
        })}

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>
            {gender === 'female' ? 'Spayed status' : 'Neutered status'}
          </Text>
          <Controller
            control={control}
            name="neuteredStatus"
            rules={{
              required: `${gender === 'female' ? 'Spayed' : 'Neutered'} status is required`,
            }}
            render={() => (
              <TileSelector
                options={getNeuteredOptions(gender)}
                selectedValue={neuteredStatus}
                onSelect={value => {
                  setValue('neuteredStatus', value as NeuteredStatus, {
                    shouldValidate: true,
                  });
                  hasUnsavedChangesRef.current = true;
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
          buildTextField('ageWhenNeutered', {
            label: `Age when ${gender === 'female' ? 'spayed' : 'neutered'} (optional)`,
            placeholder: 'e.g., 1 Year',
            maxLength: 20,
            rules: {
              validate: value => {
                if (value) {
                  const numValue = Number.parseFloat(value);
                  if (Number.isNaN(numValue)) {
                    return 'Please enter a valid number';
                  }
                  if (numValue <= 0) {
                    return 'Age must be greater than 0';
                  }
                }
                return true;
              },
            },
            dynamicSuffix: value => {
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
      {renderStepProgress()}

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

        {buildTextField('microchipNumber', {
          label: 'Microchip number (optional)',
          maxLength: 50,
        })}

        {buildTextField('passportNumber', {
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
                  hasUnsavedChangesRef.current = true;
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
            {buildTextField('insuranceCompany', {
              label: 'Insurance company (optional)',
              maxLength: 100,
            })}

            {buildTextField('insurancePolicyNumber', {
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
                  hasUnsavedChangesRef.current = true;
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
    <>
      <SafeArea style={styles.container} edges={[]}>
        <View
          style={styles.topSection}
          onLayout={event => {
            const height = event.nativeEvent.layout.height;
            if (height !== topGlassHeight) {
              setTopGlassHeight(height);
            }
          }}>
          <View style={styles.topGlassShadowWrapper}>
            <LiquidGlassCard
              glassEffect="clear"
              interactive={false}
              shadow="none"
              style={[styles.topGlassCard, {paddingTop: insets.top}]}
              fallbackStyle={styles.topGlassFallback}>
              <Header
                title={
                  currentStep === 1 ? 'Choose your companion' : 'Add companion'
                }
                showBackButton
                onBack={handleGoBack}
                glass={false}
              />
            </LiquidGlassCard>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              topGlassHeight
                ? {paddingTop: topGlassHeight + theme.spacing['3']}
                : null,
              {
                paddingBottom:
                  theme.spacing['24'] +
                  Math.max(insets.bottom, theme.spacing['3']),
              },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
          </ScrollView>

          {submissionError ? (
            <Text style={styles.submissionError}>{submissionError}</Text>
          ) : null}

          <View
            style={[
              styles.buttonContainer,
              {
                paddingBottom:
                  theme.spacing['4'] +
                  Math.max(insets.bottom, theme.spacing['3']),
              },
            ]}>
            <LiquidGlassButton
              title={primaryButtonLabel}
              onPress={handlePrimaryButtonPress}
              style={styles.button}
              textStyle={styles.buttonText}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              forceBorder
              borderColor={theme.colors.borderMuted}
              height={theme.spacing['14']}
              borderRadius={theme.borderRadius.lg}
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
      </SafeArea>

      <BreedBottomSheet
        ref={breedSheetRef}
        breeds={breedOptions}
        loadFailed={breedLoadFailed}
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
    </>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    ...createFormScreenStyles(theme),
    ...createLiquidGlassHeaderStyles(theme),
    stepContainer: {
      flex: 1,
    },
    progressBar: {
      flexDirection: 'row',
      gap: theme.spacing['1.25'],
      marginBottom: theme.spacing['5'],
    },
    progressSegment: {
      flex: 1,
      height: 4,
      borderRadius: theme.borderRadius.full,
    },
    progressSegmentActive: {
      backgroundColor: theme.colors.blue,
    },
    progressSegmentIdle: {
      backgroundColor: theme.colors.inset,
    },
    introBlock: {
      gap: theme.spacing['1.25'],
      marginBottom: theme.spacing['6'],
    },
    introTitle: {
      ...theme.typography.serifTitleSmall,
      color: theme.colors.ink,
    },
    introSubtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.inkMuted,
      lineHeight: 22,
    },
    speciesList: {
      gap: theme.spacing['3'],
      marginBottom: theme.spacing['4'],
    },
    speciesCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3.5'],
      paddingVertical: theme.spacing['4.5'],
      paddingHorizontal: theme.spacing['4'],
      backgroundColor: theme.colors.screen,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      borderRadius: theme.borderRadius.card,
    },
    speciesCardSelected: {
      borderWidth: 1.5,
      borderColor: theme.colors.pink,
      ...theme.shadows.companion,
    },
    speciesAvatar: {
      width: 56,
      height: 56,
      borderRadius: theme.borderRadius.full,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: theme.colors.screen,
      alignItems: 'center',
      justifyContent: 'center',
    },
    speciesAvatarAmber: {
      backgroundColor: theme.colors.avatarAmberBg,
    },
    speciesAvatarViolet: {
      backgroundColor: theme.colors.avatarVioletBg,
    },
    speciesAvatarGreen: {
      backgroundColor: theme.colors.avatarGreenBg,
    },
    speciesImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    speciesTextBlock: {
      flex: 1,
    },
    speciesName: {
      ...theme.typography.bodyBold,
      fontSize: 16.5,
      color: theme.colors.ink,
      letterSpacing: -0.3,
    },
    speciesSubtitle: {
      ...theme.typography.body13,
      color: theme.colors.inkMuted,
      marginTop: 1,
    },
    speciesCheck: {
      width: 24,
      height: 24,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.pink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    speciesCheckText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.ink,
    },
    suffixText: {
      ...theme.typography.input,
      color: theme.colors.textSecondary,
      marginLeft: theme.spacing['2'],
    },
  });
