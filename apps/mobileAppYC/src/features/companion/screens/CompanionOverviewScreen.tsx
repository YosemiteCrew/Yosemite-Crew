import React, {useMemo, useRef, useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  BackHandler,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';

import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch, RootState} from '@/app/store';

import {Header} from '@/shared/components/common/Header/Header';
import {useTheme} from '@/hooks';
import {capitalize, displayNeutered, displayInsured, displayOrigin} from '@/shared/utils/commonHelpers';
import {createFormScreenStyles} from '@/shared/utils/formScreenStyles';
import {Separator, RowButton} from '@/shared/components/common/FormRowComponents';

import {selectCompanionLoading, selectSelectedCompanion} from '@/features/companion/selectors';

import type {HomeStackParamList} from '@/navigation/types';

// Reusable inline editor
import {InlineEditRow} from '@/shared/components/common/InlineEditRow/InlineEditRow';

// Bottom sheets you already have
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

import {
  GenderBottomSheet,
  type GenderBottomSheetRef,
} from '@/shared/components/common/GenderBottomSheet/GenderBottomSheet';
import {
  NeuteredStatusBottomSheet,
  type NeuteredStatusBottomSheetRef,
} from '@/shared/components/common/NeuteredStatusBottomSheet/NeuteredStatusBottomSheet';
import {
  InsuredStatusBottomSheet,
  type InsuredStatusBottomSheetRef,
} from '@/shared/components/common/InsuredStatusBottomSheet/InsuredStatusBottomSheet';
import {
  OriginBottomSheet,
  type OriginBottomSheetRef,
} from '@/shared/components/common/OriginBottomSheet/OriginBottomSheet';

// Date picker (reuse same component & formatter)
import {
  SimpleDatePicker,
  formatDateForDisplay,
} from '@/shared/components/common/SimpleDatePicker/SimpleDatePicker';

// Profile Image Picker
import {CompanionProfileHeader} from '@/features/companion/components/CompanionProfileHeader';
import type {ProfileImagePickerRef} from '@/shared/components/common/ProfileImagePicker/ProfileImagePicker';

// Types
import type {
  CompanionGender,
  NeuteredStatus,
  InsuredStatus,
  CompanionOrigin,
  Breed,
  Companion
} from '@/features/companion/types';
import {setSelectedCompanion, updateCompanionProfile} from '@/features/companion';
import {usePreferences} from '@/features/preferences/PreferencesContext';
import {convertWeight} from '@/shared/utils/measurementSystem';

// Props
export type CompanionOverviewScreenProps = NativeStackScreenProps<
  HomeStackParamList,
  'EditCompanionOverview'
>;

export const CompanionOverviewScreen: React.FC<
  CompanionOverviewScreenProps
> = ({navigation, route}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const {weightUnit} = usePreferences();

  const allCompanions = useSelector((state: RootState) => state.companion.companions);
  const isLoading = useSelector(selectCompanionLoading);
  const selectedCompanionFromState = useSelector(selectSelectedCompanion);
  const selectedCompanionId = selectedCompanionFromState?.id ?? null;

  const routeParams = (route.params ?? {}) as Partial<HomeStackParamList['EditCompanionOverview']>;
  const routeCompanionId = routeParams.companionId;

  const resolvedCompanionId = useMemo(() => {
    if (routeCompanionId) {
      return routeCompanionId;
    }
    if (selectedCompanionId) {
      return selectedCompanionId;
    }
    return allCompanions[0]?.id ?? null;
  }, [routeCompanionId, selectedCompanionId, allCompanions]);

  const companion = useMemo(
    () => {
      if (resolvedCompanionId) {
        const found = allCompanions.find(c => c.id === resolvedCompanionId);
        if (found) {
          return found;
        }
      }
      return selectedCompanionFromState ?? allCompanions[0] ?? null;
    },
    [allCompanions, resolvedCompanionId, selectedCompanionFromState],
  );

  useEffect(() => {
    if (resolvedCompanionId) {
      dispatch(setSelectedCompanion(resolvedCompanionId));
    }
  }, [resolvedCompanionId, dispatch]);

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
  const profileImagePickerRef = useRef<ProfileImagePickerRef | null>(null);

  // Track which bottom sheet is open
  const [openBottomSheet, setOpenBottomSheet] = useState<'breed' | 'blood' | 'country' | 'gender' | 'neutered' | 'insured' | 'origin' | null>(null);

  // Helpers
  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const safeCompanion: Companion | null = companion ?? null;

  const applyPatch = useCallback(
    async (patch: Partial<Companion>) => {
      if (safeCompanion == null) return;

      try {
        console.log('[CompanionOverview] Applying patch:', patch);
        const updated: Companion = {
          ...safeCompanion,
          ...patch,
          updatedAt: new Date().toISOString(),
        };

        await dispatch(
          updateCompanionProfile({
            parentId: safeCompanion.userId,
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

  // Handle Android back button for bottom sheets and date picker
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Close date picker first if open
      if (showDobPicker) {
        setShowDobPicker(false);
        return true;
      }

      // Close bottom sheet first if open
      if (openBottomSheet) {
        switch (openBottomSheet) {
          case 'breed':
            breedSheetRef.current?.close();
            break;
          case 'blood':
            bloodSheetRef.current?.close();
            break;
          case 'country':
            countrySheetRef.current?.close();
            break;
          case 'gender':
            genderSheetRef.current?.close();
            break;
          case 'neutered':
            neuteredSheetRef.current?.close();
            break;
          case 'insured':
            insuredSheetRef.current?.close();
            break;
          case 'origin':
            originSheetRef.current?.close();
            break;
        }
        setOpenBottomSheet(null);
        return true;
      }

      return false;
    });

    return () => backHandler.remove();
  }, [showDobPicker, openBottomSheet]);

  const currentWeightDisplay = useMemo(() => {
    if (!safeCompanion?.currentWeight) {
      return '';
    }

    // Weight is stored in kg, convert if user prefers lbs
    let weight = safeCompanion.currentWeight;
    if (weightUnit === 'lbs') {
      weight = convertWeight(weight, 'kg', 'lbs');
    }

    return `${weight.toFixed(1)} ${weightUnit}`;
  }, [safeCompanion, weightUnit]);

  const ageWhenNeuteredDisplay = useMemo(() => {
    if (!safeCompanion?.ageWhenNeutered) return '';
    const age = safeCompanion.ageWhenNeutered;
    const numValue = Number.parseFloat(age);
    if (Number.isNaN(numValue)) return age;
    return `${age} ${numValue === 1 ? 'Year' : 'Years'}`;
  }, [safeCompanion]);

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
        <CompanionProfileHeader
          name={safeCompanion.name}
          breedName={safeCompanion.breed?.breedName}
          profileImage={safeCompanion.profileImage ?? undefined}
          pickerRef={profileImagePickerRef}
          onImageSelected={handleProfileImageChange}
        />

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
              onPress={() => {
                setOpenBottomSheet('breed');
                breedSheetRef.current?.open();
              }}
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
              onPress={() => {
                setOpenBottomSheet('gender');
                genderSheetRef.current?.open();
              }}
            />

            <Separator />

            {/* Current weight – Inline */}
            <InlineEditRow
              label="Current weight"
              value={currentWeightDisplay}
              keyboardType="decimal-pad"
              onSave={val => {
                // Remove any non-numeric or unit text
                const cleaned = val.replaceAll(/[^0-9.]/g, '').trim();
                let num = cleaned === '' ? null : Number(cleaned);

                // Convert to kg if user entered in lbs
                if (num !== null && !Number.isNaN(num) && weightUnit === 'lbs') {
                  num = convertWeight(num, 'lbs', 'kg');
                }

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
              onPress={() => {
                setOpenBottomSheet('neutered');
                neuteredSheetRef.current?.open();
              }}
            />

            {safeCompanion.neuteredStatus === 'neutered' && (
              <>
                <Separator />
                <InlineEditRow
                  label="Age when neutered"
                  value={ageWhenNeuteredDisplay}
                  onSave={val => {
                    // Remove unit text (Year/Years) before saving - using string methods to avoid ReDoS
                    let cleaned = val.trim();
                    if (cleaned.toLowerCase().endsWith(' years')) {
                      cleaned = cleaned.slice(0, -6).trim();
                    } else if (cleaned.toLowerCase().endsWith(' year')) {
                      cleaned = cleaned.slice(0, -5).trim();
                    }
                    applyPatch({ageWhenNeutered: cleaned || null});
                  }}
                />
              </>
            )}

            <Separator />

            {/* Blood group – Bottom sheet */}
            <RowButton
              label="Blood group"
              value={safeCompanion.bloodGroup ?? ''}
              onPress={() => {
                setOpenBottomSheet('blood');
                bloodSheetRef.current?.open();
              }}
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
              onPress={() => {
                setOpenBottomSheet('insured');
                insuredSheetRef.current?.open();
              }}
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
              onPress={() => {
                setOpenBottomSheet('country');
                countrySheetRef.current?.open();
              }}
            />

            <Separator />

            {/* Pet comes from – Bottom sheet */}
            <RowButton
              label="My pet comes from"
              value={displayOrigin(safeCompanion.origin)}
              onPress={() => {
                setOpenBottomSheet('origin');
                originSheetRef.current?.open();
              }}
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
        onSave={(b: Breed | null) => {
          applyPatch({breed: b});
          setOpenBottomSheet(null);
        }}
      />

      <BloodGroupBottomSheet
        ref={bloodSheetRef}
        selectedBloodGroup={safeCompanion.bloodGroup ?? null}
        category={safeCompanion.category}
        onSave={(bg: string | null) => {
          applyPatch({bloodGroup: bg});
          setOpenBottomSheet(null);
        }}
      />

      <CountryBottomSheet
        ref={countrySheetRef}
        countries={require('@/shared/utils/countryList.json')}
        selectedCountry={getSelectedCountryObject(
          safeCompanion.countryOfOrigin,
        )}
        onSave={country => {
          applyPatch({countryOfOrigin: country ? country.name : null});
          setOpenBottomSheet(null);
        }}
      />

      <GenderBottomSheet
        ref={genderSheetRef}
        selected={safeCompanion.gender as CompanionGender | null}
        onSave={g => {
          applyPatch({gender: g});
          setOpenBottomSheet(null);
        }}
      />

      <NeuteredStatusBottomSheet
        ref={neuteredSheetRef}
        selected={safeCompanion.neuteredStatus as NeuteredStatus | null}
        onSave={n => {
          const patch: Partial<Companion> = {neuteredStatus: n};
          if (n !== 'neutered') patch.ageWhenNeutered = null; // reset dependent
          applyPatch(patch);
          setOpenBottomSheet(null);
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
          setOpenBottomSheet(null);
        }}
      />

      <OriginBottomSheet
        ref={originSheetRef}
        selected={safeCompanion.origin as CompanionOrigin | null}
        onSave={o => {
          applyPatch({origin: o});
          setOpenBottomSheet(null);
        }}
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

import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';

// Helper functions moved to @/shared/utils/commonHelpers:
// - capitalize, displayNeutered, displayInsured, displayOrigin

// Use same util as AddCompanionScreen if exported; otherwise fallback safe helper here.
function getBreedListByCategorySafe(category: any): Breed[] {
  try {
    const CAT_BREEDS = require('@/features/companion/data/catBreeds.json');
    const DOG_BREEDS = require('@/features/companion/data/dogBreeds.json');
    const HORSE_BREEDS = require('@/features/companion/data/horseBreeds.json');
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
    const COUNTRIES = require('@/shared/utils/countryList.json');
    if (countryName == null || countryName === '') {
      return null;
    }
    return COUNTRIES.find((c: any) => c.name === countryName) ?? null;
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    ...createFormScreenStyles(theme),
  });
