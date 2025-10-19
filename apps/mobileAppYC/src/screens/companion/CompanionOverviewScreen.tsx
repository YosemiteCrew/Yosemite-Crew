import React, {useMemo, useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';

import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from '@/app/store';

import {Header} from '@/components';
import {LiquidGlassCard} from '@/components/common/LiquidGlassCard/LiquidGlassCard';
import {Images} from '@/assets/images';
import {useTheme} from '@/hooks';

import {
  selectSelectedCompanion,
  selectCompanionLoading,
} from '@/features/companion/selectors';

import type {HomeStackParamList} from '@/navigation/types';

// Reusable inline editor
import {InlineEditRow} from '@/components/common/InlineEditRow/InlineEditRow';

// Bottom sheets you already have
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

import {
  GenderBottomSheet,
  type GenderBottomSheetRef,
} from '@/components/common/GenderBottomSheet/GenderBottomSheet';
import {
  NeuteredStatusBottomSheet,
  type NeuteredStatusBottomSheetRef,
} from '@/components/common/NeuteredStatusBottomSheet/NeuteredStatusBottomSheet';
import {
  InsuredStatusBottomSheet,
  type InsuredStatusBottomSheetRef,
} from '@/components/common/InsuredStatusBottomSheet/InsuredStatusBottomSheet';
import {
  OriginBottomSheet,
  type OriginBottomSheetRef,
} from '@/components/common/OriginBottomSheet/OriginBottomSheet';

// Date picker (reuse same component & formatter)
import {
  SimpleDatePicker,
  formatDateForDisplay,
} from '@/components/common/SimpleDatePicker/SimpleDatePicker';

// Profile Image Picker
import {ProfileImagePicker} from '@/components/common/ProfileImagePicker/ProfileImagePicker';

// Types
import type {
  CompanionGender,
  NeuteredStatus,
  InsuredStatus,
  CompanionOrigin,
  Breed,
  Companion
} from '@/features/companion/types';
import {updateCompanionProfile} from '@/features/companion';

// Props
export type CompanionOverviewScreenProps = NativeStackScreenProps<
  HomeStackParamList,
  'EditCompanionOverview'
>;

export const CompanionOverviewScreen: React.FC<
  CompanionOverviewScreenProps
> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();

  const companion = useSelector(selectSelectedCompanion);
  const isLoading = useSelector(selectCompanionLoading);

  // Local UI state
  const [showDobPicker, setShowDobPicker] = useState(false);

  // Bottom sheet refs
  const breedSheetRef = useRef<BreedBottomSheetRef>(null);
  const bloodSheetRef = useRef<BloodGroupBottomSheetRef>(null);
  const countrySheetRef = useRef<CountryBottomSheetRef>(null);
  const genderSheetRef = useRef<GenderBottomSheetRef>(null);
  const neuteredSheetRef = useRef<NeuteredStatusBottomSheetRef>(null);
  const insuredSheetRef = useRef<InsuredStatusBottomSheetRef>(null);
  const originSheetRef = useRef<OriginBottomSheetRef>(null);

  // Profile image picker ref
  const profileImagePickerRef = useRef<{ triggerPicker: () => void }>(null);

  // Helpers
  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const safeCompanion = companion as Companion;

  const applyPatch = useCallback(
    async (patch: Partial<Companion>) => {
      if (safeCompanion == null) return;

      try {
        console.log('[CompanionOverview] Applying patch:', patch);
        const updated: Companion = {
          ...safeCompanion,
          ...patch,
          updatedAt: new Date().toISOString(),
        } as Companion;

        await dispatch(
          updateCompanionProfile({
            userId: safeCompanion.userId,
            updatedCompanion: updated,
          }),
        ).unwrap();

        console.log('[CompanionOverview] Profile updated successfully');
      } catch (error) {
        console.error('[CompanionOverview] Failed to update profile:', error);
        Alert.alert(
          'Update Failed',
          'Failed to update companion profile. Please try again.',
          [{text: 'OK'}]
        );
      }
    },
    [dispatch, safeCompanion],
  );

  const handleProfileImageChange = useCallback(
    async (imageUri: string | null) => {
      try {
        console.log('[CompanionOverview] Profile image change:', imageUri);
        await applyPatch({ profileImage: imageUri || undefined });
      } catch (error) {
        console.error('[CompanionOverview] Failed to update profile image:', error);
        Alert.alert(
          'Image Update Failed',
          'Failed to update profile image. Please try again.',
          [{text: 'OK'}]
        );
      }
    },
    [applyPatch],
  );

  if (safeCompanion == null) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Overview" showBackButton onBack={goBack} />
        <View style={styles.centered}>
          {isLoading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} />
          ) : (
            <Text style={styles.muted}>Companion not found.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const currentWeightDisplay =
    safeCompanion.currentWeight === null || safeCompanion.currentWeight === undefined
      ? ''
      : `${safeCompanion.currentWeight} kg`;

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={`${safeCompanion.name}'s Overview`}
        showBackButton
        onBack={goBack}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Header block */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <ProfileImagePicker
              ref={profileImagePickerRef}
              imageUri={safeCompanion.profileImage}
              onImageSelected={handleProfileImageChange}
              size={100}
              pressable={false}
              fallbackText={safeCompanion.name.charAt(0).toUpperCase()}
            />
            <TouchableOpacity style={styles.cameraIconContainer} onPress={() => {
              profileImagePickerRef.current?.triggerPicker();
            }}>
              <Image source={Images.cameraIcon} style={styles.cameraIcon} />
            </TouchableOpacity>
          </View>
          <Text style={styles.profileName}>{safeCompanion.name}</Text>
          <Text style={styles.profileBreed}>
            {safeCompanion.breed?.breedName ?? 'Unknown Breed'}
          </Text>
        </View>

        {/* Card with rows */}
        <LiquidGlassCard
          glassEffect="clear"
          interactive
          tintColor={theme.colors.white}
          style={styles.glassContainer}
          fallbackStyle={styles.glassFallback}>
          <View style={styles.listContainer}>
            {/* Name – Inline */}
            <InlineEditRow
              label="Name"
              value={safeCompanion.name ?? ''}
              onSave={val => applyPatch({name: val})}
            />

            <Separator />

            {/* Breed – Bottom sheet */}
            <RowButton
              label="Breed"
              value={safeCompanion.breed?.breedName ?? ''}
              onPress={() => breedSheetRef.current?.open()}
            />

            <Separator />

            {/* Date of birth – Date picker */}
            <RowButton
              label="Date of birth"
              value={
                safeCompanion.dateOfBirth
                  ? formatDateForDisplay(new Date(safeCompanion.dateOfBirth))
                  : ''
              }
              onPress={() => setShowDobPicker(true)}
            />

            <Separator />

            {/* Gender – Bottom sheet */}
            <RowButton
              label="Gender"
              value={
                safeCompanion.gender ? capitalize(safeCompanion.gender) : ''
              }
              onPress={() => genderSheetRef.current?.open()}
            />

            <Separator />

            {/* Current weight – Inline (kg) */}
            <InlineEditRow
              label="Current weight"
              value={currentWeightDisplay}
              keyboardType="decimal-pad"
              onSave={val => {
                // Remove any non-numeric or unit text like "kg"
                const cleaned = val.replaceAll(/[^0-9.]/g, '').trim();
                const num = cleaned === '' ? null : Number(cleaned);
                applyPatch({
                  currentWeight:
                    num === null || Number.isNaN(num) ? null : num,
                });
              }}
            />

            <Separator />

            {/* Colour – Inline */}
            <InlineEditRow
              label="Colour"
              value={safeCompanion.color ?? ''}
              onSave={val => applyPatch({color: val || null})}
            />

            <Separator />

            {/* Allergies – Inline multiline */}
            <InlineEditRow
              label="Allergies"
              value={safeCompanion.allergies ?? ''}
              multiline
              onSave={val => applyPatch({allergies: val || null})}
            />

            <Separator />

            {/* Neutered status – Bottom sheet */}
            <RowButton
              label="Neutered status"
              value={displayNeutered(safeCompanion.neuteredStatus)}
              onPress={() => neuteredSheetRef.current?.open()}
            />

            {safeCompanion.neuteredStatus === 'neutered' && (
              <>
                <Separator />
                <InlineEditRow
                  label="Age when neutered"
                  value={safeCompanion.ageWhenNeutered ?? ''}
                  onSave={val => applyPatch({ageWhenNeutered: val || null})}
                />
              </>
            )}

            <Separator />

            {/* Blood group – Bottom sheet */}
            <RowButton
              label="Blood group"
              value={safeCompanion.bloodGroup ?? ''}
              onPress={() => bloodSheetRef.current?.open()}
            />

            <Separator />

            {/* Microchip number – Inline */}
            <InlineEditRow
              label="Microchip number"
              value={safeCompanion.microchipNumber ?? ''}
              onSave={val => applyPatch({microchipNumber: val || null})}
            />

            <Separator />

            {/* Passport number – Inline */}
            <InlineEditRow
              label="Passport number"
              value={safeCompanion.passportNumber ?? ''}
              onSave={val => applyPatch({passportNumber: val || null})}
            />

            <Separator />

            {/* Insured – Bottom sheet */}
            <RowButton
              label="Insurance status"
              value={displayInsured(safeCompanion.insuredStatus)}
              onPress={() => insuredSheetRef.current?.open()}
            />

            {safeCompanion.insuredStatus === 'insured' && (
              <>
                <Separator />
                <InlineEditRow
                  label="Insurance company"
                  value={safeCompanion.insuranceCompany ?? ''}
                  onSave={val => applyPatch({insuranceCompany: val || null})}
                />
                <Separator />
                <InlineEditRow
                  label="Policy number"
                  value={safeCompanion.insurancePolicyNumber ?? ''}
                  onSave={val =>
                    applyPatch({insurancePolicyNumber: val || null})
                  }
                />
              </>
            )}

            <Separator />

            {/* Country of origin – Bottom sheet */}
            <RowButton
              label="Country of origin"
              value={safeCompanion.countryOfOrigin ?? ''}
              onPress={() => countrySheetRef.current?.open()}
            />

            <Separator />

            {/* Pet comes from – Bottom sheet */}
            <RowButton
              label="My pet comes from"
              value={displayOrigin(safeCompanion.origin)}
              onPress={() => originSheetRef.current?.open()}
            />
          </View>
        </LiquidGlassCard>
      </ScrollView>

      {/* ====== Bottom Sheets / Pickers ====== */}
      <BreedBottomSheet
        ref={breedSheetRef}
        // You likely have a util to supply list by category; here we use current category's breed list from Add screen util
        breeds={
          (safeCompanion.category &&
            getBreedListByCategorySafe(safeCompanion.category)) ||
          []
        }
        selectedBreed={safeCompanion.breed ?? null}
        onSave={(b: Breed | null) => applyPatch({breed: b})}
      />

      <BloodGroupBottomSheet
        ref={bloodSheetRef}
        selectedBloodGroup={safeCompanion.bloodGroup ?? null}
        category={safeCompanion.category}
        onSave={(bg: string | null) => applyPatch({bloodGroup: bg})}
      />

      <CountryBottomSheet
        ref={countrySheetRef}
        countries={require('@/utils/countryList.json')}
        selectedCountry={getSelectedCountryObject(
          safeCompanion.countryOfOrigin,
        )}
        onSave={country =>
          applyPatch({countryOfOrigin: country ? country.name : null})
        }
      />

      <GenderBottomSheet
        ref={genderSheetRef}
        selected={safeCompanion.gender as CompanionGender | null}
        onSave={g => applyPatch({gender: g})}
      />

      <NeuteredStatusBottomSheet
        ref={neuteredSheetRef}
        selected={safeCompanion.neuteredStatus as NeuteredStatus | null}
        onSave={n => {
          const patch: Partial<Companion> = {neuteredStatus: n};
          if (n !== 'neutered') patch.ageWhenNeutered = null; // reset dependent
          applyPatch(patch);
        }}
      />

      <InsuredStatusBottomSheet
        ref={insuredSheetRef}
        selected={safeCompanion.insuredStatus as InsuredStatus | null}
        onSave={s => {
          const patch: Partial<Companion> = {insuredStatus: s};
          if (s !== 'insured') {
            patch.insuranceCompany = null;
            patch.insurancePolicyNumber = null;
          }
          applyPatch(patch);
        }}
      />

      <OriginBottomSheet
        ref={originSheetRef}
        selected={safeCompanion.origin as CompanionOrigin | null}
        onSave={o => applyPatch({origin: o})}
      />

      <SimpleDatePicker
        value={
          safeCompanion.dateOfBirth ? new Date(safeCompanion.dateOfBirth) : null
        }
        onDateChange={date => {
          applyPatch({dateOfBirth: date ? date.toISOString() : null});
          setShowDobPicker(false);
        }}
        show={showDobPicker}
        onDismiss={() => setShowDobPicker(false)}
        maximumDate={new Date()}
        mode="date"
      />
    </SafeAreaView>
  );
};

/* ----------------- Small shared pieces ----------------- */
const Separator = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.separator} />
  );
};

const RowButton: React.FC<{
  label: string;
  value?: string;
  onPress: () => void;
}> = ({label, value, onPress}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <TouchableOpacity
      style={styles.rowButtonTouchable}
      activeOpacity={0.8}
      onPress={onPress}>
      <Text style={styles.rowButtonLabel}>
        {label}
      </Text>
      <Text
        style={styles.rowButtonValue}
        numberOfLines={1}>
        {value || ' '}
      </Text>
      <Image
        source={Images.rightArrow}
        style={styles.rowButtonArrow}
      />
    </TouchableOpacity>
  );
};

function capitalize(s?: string | null) {
  if (s == null || s === '') {
    return '';
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function displayNeutered(v?: NeuteredStatus | null) {
  if (v == null) {
    return '';
  }
  return v === 'neutered' ? 'Neutered' : 'Not neutered';
}

function displayInsured(v?: InsuredStatus | null) {
  if (v == null) {
    return '';
  }
  return v === 'insured' ? 'Insured' : 'Not insured';
}

function displayOrigin(v?: CompanionOrigin | null) {
  switch (v) {
    case 'shop':
      return 'Shop';
    case 'breeder':
      return 'Breeder';
    case 'foster-shelter':
      return 'Foster/ Shelter';
    case 'friends-family':
      return 'Friends or family';
    case 'unknown':
      return 'Unknown';
    default:
      return '';
  }
}

// Use same util as AddCompanionScreen if exported; otherwise fallback safe helper here.
function getBreedListByCategorySafe(category: any): Breed[] {
  try {
    const CAT_BREEDS = require('@/utils/catBreeds.json');
    const DOG_BREEDS = require('@/utils/dogBreeds.json');
    const HORSE_BREEDS = require('@/utils/horseBreeds.json');
    switch (category) {
      case 'cat':
        return CAT_BREEDS;
      case 'dog':
        return DOG_BREEDS;
      case 'horse':
        return HORSE_BREEDS;
      default:
        return [];
    }
  } catch {
    return [];
  }
}

function getSelectedCountryObject(countryName?: string | null) {
    const COUNTRIES = require('@/utils/countryList.json');
    if (countryName == null || countryName === '') {
      return null;
    }
    return COUNTRIES.find((c: any) => c.name === countryName) ?? null;
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      paddingHorizontal: theme.spacing[5],
      paddingBottom: theme.spacing[10],
    },
    profileHeader: {
      alignItems: 'center',
      marginVertical: theme.spacing[6],
    },
    avatarContainer: {
      position: 'relative',
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.border,
    },
    cameraIconContainer: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: theme.colors.secondary,
      padding: theme.spacing[2],
      borderRadius: theme.borderRadius.full,
      borderWidth: 2,
      borderColor: theme.colors.background,
    },
    cameraIcon: {
      width: 16,
      height: 16,
      tintColor: theme.colors.white,
    },
    profileName: {
      ...theme.typography.h4Alt,
      color: theme.colors.secondary,
      marginTop: theme.spacing[4],
    },
    profileBreed: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing[1],
    },
    glassContainer: {
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing[2],
      overflow: 'hidden',
      ...theme.shadows.md,
    },
    glassFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.borderMuted,
    },
    listContainer: {
      gap: theme.spacing[1],
    },
    muted: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    separator: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.borderSeperator,
      marginLeft: 16,
    },
    rowButtonTouchable: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing[3],
      paddingHorizontal: theme.spacing[3],
    },
    rowButtonLabel: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
      flex: 1,
    },
    rowButtonValue: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      marginRight: theme.spacing[3],
    },
    rowButtonArrow: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
  });
