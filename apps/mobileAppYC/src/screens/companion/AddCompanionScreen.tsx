/* istanbul ignore file -- complex native picker workflow exercised through manual QA */
// src/screens/companion/AddCompanionScreen.tsx
import React, {useState, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity,
} from 'react-native';
import {useForm, Controller} from 'react-hook-form';
import {SafeArea, Input, Header} from '../../components/common';
import {ProfileImagePicker} from '../../components/common/ProfileImagePicker/ProfileImagePicker';
import {TileSelector} from '../../components/common/TileSelector/TileSelector';
import {
  SimpleDatePicker,
  formatDateForDisplay,
} from '../../components/common/SimpleDatePicker/SimpleDatePicker';
import {TouchableInput} from '../../components/common/TouchableInput/TouchableInput';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {
  BreedBottomSheet,
  type BreedBottomSheetRef,
} from '@/components/common/BreedBottomSheet/BreedBottomSheet';
import {
  BloodGroupBottomSheet,
  type BloodGroupBottomSheetRef,
} from '@/components/common/BloodGroupBottomSheet/BloodGroupBottomSheet';

import {
  CountryBottomSheet,
  type CountryBottomSheetRef,
} from '@/components/common/CountryBottomSheet/CountryBottomSheet';

import {useTheme} from '../../hooks';
import {Images} from '../../assets/images';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {HomeStackParamList} from '../../navigation/types';
import COUNTRIES from '../../utils/countryList.json';
import CAT_BREEDS from '../../utils/catBreeds.json';
import DOG_BREEDS from '../../utils/dogBreeds.json';
import HORSE_BREEDS from '../../utils/horseBreeds.json';
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
import {useAuth} from '@/contexts/AuthContext';

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

  const breedSheetRef = useRef<BreedBottomSheetRef>(null);
  const bloodGroupSheetRef = useRef<BloodGroupBottomSheetRef>(null);
  const countrySheetRef = useRef<CountryBottomSheetRef>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

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



  const handleGoBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  }, [currentStep, navigation]);

  const handleProfileImageChange = useCallback(
    (imageUri: string | null) => {
      setValue('profileImage', imageUri, {shouldValidate: true});
    },
    [setValue],
  );

  const handleBreedPress = useCallback(() => {
    breedSheetRef.current?.open();
  }, []);

  const handleBreedSave = useCallback(
    (selectedBreed: Breed | null) => {
      setValue('breed', selectedBreed, {shouldValidate: true});
    },
    [setValue],
  );

  const handleBloodGroupPress = useCallback(() => {
    bloodGroupSheetRef.current?.open();
  }, []);

  const handleBloodGroupSave = useCallback(
    (selectedBloodGroup: string | null) => {
      setValue('bloodGroup', selectedBloodGroup, {shouldValidate: true});
    },
    [setValue],
  );

  const handleCountryPress = useCallback(() => {
    countrySheetRef.current?.open();
  }, []);

  const handleCountrySave = useCallback(
    (country: any) => {
      setValue('countryOfOrigin', country.name, {shouldValidate: true});
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

    if (!user?.id) {
      setSubmissionError('User not found. Please log in again.');
      console.error('User not found');
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

    const companionPayload = {
      category: data.category,
      name: data.name,
      breed: data.breed,
      dateOfBirth: data.dateOfBirth?.toISOString() ?? null,
      gender: data.gender,
      currentWeight: data.currentWeight ? Number.parseFloat(data.currentWeight) : null,
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
          userId: user.id,
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
        <Controller
          control={control}
          name="name"
          rules={{
            required: 'Name is required',
            minLength: {
              value: 2,
              message: 'Name must be at least 2 characters',
            },
          }}
          render={({field: {onChange, value}}) => (
            <Input
              label="Name"
              value={value}
              onChangeText={onChange}
              error={errors.name?.message}
              maxLength={50}
              containerStyle={styles.inputContainer}
            />
          )}
        />

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
                onSelect={value =>
                  setValue('gender', value as CompanionGender, {
                    shouldValidate: true,
                  })
                }
              />
            )}
          />
          {errors.gender?.message && (
            <Text style={styles.errorText}>{errors.gender.message}</Text>
          )}
        </View>

        <Controller
          control={control}
          name="currentWeight"
          render={({field: {onChange, value}}) => (
            <Input
              label="Current weight (optional)"
              value={value}
              onChangeText={onChange}
              placeholder="kgs"
              keyboardType="decimal-pad"
              error={errors.currentWeight?.message}
              containerStyle={styles.inputContainer}
            />
          )}
        />

        <Controller
          control={control}
          name="color"
          render={({field: {onChange, value}}) => (
            <Input
              label="Colour (optional)"
              value={value}
              onChangeText={onChange}
              error={errors.color?.message}
              maxLength={50}
              containerStyle={styles.inputContainer}
            />
          )}
        />

        <Controller
          control={control}
          name="allergies"
          render={({field: {onChange, value}}) => (
            <Input
              label="Allergies (optional)"
              value={value}
              onChangeText={onChange}
              error={errors.allergies?.message}
              maxLength={200}
              multiline
              containerStyle={styles.inputContainer}
            />
          )}
        />

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
                onSelect={value =>
                  setValue('neuteredStatus', value as NeuteredStatus, {
                    shouldValidate: true,
                  })
                }
              />
            )}
          />
          {errors.neuteredStatus?.message && (
            <Text style={styles.errorText}>
              {errors.neuteredStatus.message}
            </Text>
          )}
        </View>

        {neuteredStatus === 'neutered' && (
          <Controller
            control={control}
            name="ageWhenNeutered"
            render={({field: {onChange, value}}) => (
              <Input
                label="Age when neutered"
                value={value}
                onChangeText={onChange}
                placeholder="e.g., 1 Year"
                error={errors.ageWhenNeutered?.message}
                maxLength={20}
                containerStyle={styles.inputContainer}
              />
            )}
          />
        )}
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

        <Controller
          control={control}
          name="microchipNumber"
          render={({field: {onChange, value}}) => (
            <Input
              label="Microchip number (optional)"
              value={value}
              onChangeText={onChange}
              error={errors.microchipNumber?.message}
              maxLength={50}
              containerStyle={styles.inputContainer}
            />
          )}
        />

        <Controller
          control={control}
          name="passportNumber"
          render={({field: {onChange, value}}) => (
            <Input
              label="Passport number (optional)"
              value={value}
              onChangeText={onChange}
              error={errors.passportNumber?.message}
              maxLength={50}
              containerStyle={styles.inputContainer}
            />
          )}
        />

        <View style={styles.fieldGroup}>
          <Controller
            control={control}
            name="insuredStatus"
            rules={{required: 'Insurance status is required'}}
            render={() => (
              <TileSelector
                options={INSURED_OPTIONS}
                selectedValue={insuredStatus}
                onSelect={value =>
                  setValue('insuredStatus', value as InsuredStatus, {
                    shouldValidate: true,
                  })
                }
              />
            )}
          />
          {errors.insuredStatus?.message && (
            <Text style={styles.errorText}>{errors.insuredStatus.message}</Text>
          )}
        </View>

        {insuredStatus === 'insured' && (
          <React.Fragment key="insurance-fields">
            <Controller
              control={control}
              name="insuranceCompany"
              render={({field: {onChange, value}}) => (
                <Input
                  label="Insurance company (optional)"
                  value={value}
                  onChangeText={onChange}
                  error={errors.insuranceCompany?.message}
                  maxLength={100}
                  containerStyle={styles.inputContainer}
                />
              )}
            />

            <Controller
              control={control}
              name="insurancePolicyNumber"
              render={({field: {onChange, value}}) => (
                <Input
                  label="Insurance policy number"
                  value={value}
                  onChangeText={onChange}
                  placeholder="Insurance policy number"
                  error={errors.insurancePolicyNumber?.message}
                  maxLength={50}
                  containerStyle={styles.inputContainer}
                />
              )}
            />
          </React.Fragment>
        )}

        <Controller
          control={control}
          name="countryOfOrigin"
          render={() => (
            <TouchableInput
              label="Country of origin (optional)"
              value={countryOfOrigin ?? ''}
              placeholder="Select country"
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
                onSelect={value =>
                  setValue('origin', value as CompanionOrigin, {
                    shouldValidate: true,
                  })
                }
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
            title={(() => {
              if (currentStep === 1) {
                return 'Next';
              }
              if (currentStep === 2) {
                return 'Next';
              }
              if (isSubmitting) {
                return 'Saving...';
              }
              return 'Save';
            })()}
            onPress={(() => {
              if (currentStep === 1) {
                return handleStep1Next;
              }
              if (currentStep === 2) {
                return handleStep2Next;
              }
              return handleSave;
            })()}
            style={styles.button}
            textStyle={styles.buttonText}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            forceBorder
            borderColor="rgba(255, 255, 255, 0.35)"
            height={56}
            borderRadius={16}
            loading={currentStep === 3 && isSubmitting}
            disabled={currentStep === 3 && isSubmitting}
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
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['24'],
    },
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
    formSection: {
      marginBottom: theme.spacing['5'],
      gap: theme.spacing['4'],
    },
    inputContainer: {
      marginBottom: 0,
    },
    fieldGroup: {
      gap: theme.spacing['3'],
      paddingBottom:5
    },
    fieldLabel: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600',
    },
    dropdownIcon: {
      width: theme.spacing['3'],
      height: theme.spacing['3'],
      marginLeft: theme.spacing['2'],
      tintColor: theme.colors.textSecondary,
    },
    calendarIcon: {
      width: theme.spacing['5'],
      height: theme.spacing['5'],
      tintColor: theme.colors.textSecondary,
    },
    errorText: {
      ...theme.typography.labelXsBold,
      color: theme.colors.error,
      marginTop: -theme.spacing[3],
      marginBottom: theme.spacing[3],
      marginLeft: theme.spacing[1],
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
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['4'],
      paddingBottom: theme.spacing['4'],
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
  });
