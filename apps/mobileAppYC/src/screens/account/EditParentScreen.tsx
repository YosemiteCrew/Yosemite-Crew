import React, {useMemo, useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  StyleSheet as RNStyleSheet,
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
  selectAuthUser,
  selectAuthIsLoading,
} from '@/features/auth/selectors';

import type {HomeStackParamList} from '@/navigation/types';

// Reusable inline editor
import {InlineEditRow} from '@/components/common/InlineEditRow/InlineEditRow';
import COUNTRIES from '@/utils/countryList.json';

// Bottom sheets
import {
  CurrencyBottomSheet,
  type CurrencyBottomSheetRef,
} from '@/components/common/CurrencyBottomSheet/CurrencyBottomSheet';
import {
  AddressBottomSheet,
  type AddressBottomSheetRef,
} from '@/components/common/AddressBottomSheet/AddressBottomSheet';
import {
  CountryMobileBottomSheet,
  type CountryMobileBottomSheetRef,
} from '@/components/common/CountryMobileBottomSheet/CountryMobileBottomSheet';

// Date picker (reuse same component & formatter)
import {
  SimpleDatePicker,
  formatDateForDisplay,
} from '@/components/common/SimpleDatePicker/SimpleDatePicker';

// Profile Image Picker
import {ProfileImagePicker} from '@/components/common/ProfileImagePicker/ProfileImagePicker';

// Types
import type {User} from '@/features/auth/types';
import {updateUserProfile} from '@/features/auth';

// Props
export type EditParentScreenProps = NativeStackScreenProps<
  HomeStackParamList,
  'EditParentOverview'
>;

export const EditParentScreen: React.FC<EditParentScreenProps> = ({
  navigation,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();

  const user = useSelector(selectAuthUser);
  const isLoading = useSelector(selectAuthIsLoading);

  // Local UI state
  const [showDobPicker, setShowDobPicker] = useState(false);

  // Bottom sheet refs
  const currencySheetRef = useRef<CurrencyBottomSheetRef>(null);
  const addressSheetRef = useRef<AddressBottomSheetRef>(null);
  const phoneSheetRef = useRef<CountryMobileBottomSheetRef>(null);

  // Helpers
  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const safeUser = user as User;

  const applyPatch = useCallback(
    (patch: Partial<User>) => {
      if (!safeUser) return;
      dispatch(updateUserProfile(patch));
    },
    [dispatch, safeUser],
  );

  // Parse phone number to separate dial code and local number
  const parsedPhone = useMemo(() => {
    if (!safeUser.phone) return { dialCode: '+1', localNumber: '' };
    const rawPhone = safeUser.phone.replace(/[^0-9+]/g, '');
    const normalizedPhoneDigits = rawPhone.replace(/\D/g, '');
    let resolvedCountry = COUNTRIES.find(country => country.code === 'US') ?? COUNTRIES[0];
    if (normalizedPhoneDigits) {
      const match = COUNTRIES.find(country => {
        const dialCodeDigits = country.dial_code.replace('+', '');
        return normalizedPhoneDigits.startsWith(dialCodeDigits);
      });
      if (match) resolvedCountry = match;
    }
    const localPhoneRaw = normalizedPhoneDigits.startsWith(
      resolvedCountry.dial_code.replace('+', ''),
    )
      ? normalizedPhoneDigits.slice(
          resolvedCountry.dial_code.replace('+', '').length,
        )
      : normalizedPhoneDigits;
    const localPhoneNumber = localPhoneRaw.slice(-10);
    return { dialCode: resolvedCountry.dial_code, localNumber: localPhoneNumber };
  }, [safeUser.phone]);

  const handleProfileImageChange = useCallback(
    (imageUri: string | null) => {
      applyPatch({ profilePicture: imageUri || undefined });
    },
    [applyPatch],
  );

  if (!safeUser) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Edit Profile" showBackButton onBack={goBack} />
        <View style={styles.centered}>
          {isLoading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} />
          ) : (
            <Text style={styles.muted}>User not found.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Edit Profile"
        showBackButton
        onBack={goBack}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Header block */}
        <View style={styles.profileHeader}>
          <ProfileImagePicker
            imageUri={safeUser.profilePicture}
            onImageSelected={handleProfileImageChange}
            size={100} // Decreased size
          />
        </View>

        {/* Card with rows */}
        <LiquidGlassCard
          glassEffect="clear"
          interactive
          tintColor={theme.colors.white}
          style={styles.glassContainer}
          fallbackStyle={styles.glassFallback}>
          <View style={styles.listContainer}>
            {/* First Name – Inline */}
            <InlineEditRow
              label="First name"
              value={safeUser.firstName ?? ''}
              onSave={val => applyPatch({firstName: val})}
            />

            <Separator />

            {/* Last Name – Inline */}
            <InlineEditRow
              label="Last name"
              value={safeUser.lastName ?? ''}
              onSave={val => applyPatch({lastName: val})}
            />

            <Separator />

            {/* Phone – Bottom sheet */}
            <RowButton
              label="Phone"
              value={safeUser.phone ? `${parsedPhone.dialCode} ${parsedPhone.localNumber}` : ''}
              onPress={() => phoneSheetRef.current?.open()}
            />

            <Separator />

            {/* Date of birth – Date picker */}
            <RowButton
              label="Date of birth"
              value={
                safeUser.dateOfBirth
                  ? formatDateForDisplay(new Date(safeUser.dateOfBirth))
                  : ''
              }
              onPress={() => setShowDobPicker(true)}
            />

            <Separator />

            {/* Currency – Bottom sheet */}
            <RowButton
              label="Currency"
              value={safeUser.currency ?? 'USD'}
              onPress={() => currencySheetRef.current?.open()}
            />

            <Separator />

            {/* Address – Multiple rows, all opening AddressBottomSheet */}
            <RowButton
              label="Address"
              value={safeUser.address?.addressLine ?? ''}
              onPress={() => addressSheetRef.current?.open()}
              key="address"
            />

            <Separator />

            <RowButton
              label="State/Province"
              value={safeUser.address?.stateProvince ?? ''}
              onPress={() => addressSheetRef.current?.open()}
              key="stateProvince"
            />

            <Separator />

            <RowButton
              label="City"
              value={safeUser.address?.city ?? ''}
              onPress={() => addressSheetRef.current?.open()}
              key="city"
            />

            <Separator />

            <RowButton
              label="Postal Code"
              value={safeUser.address?.postalCode ?? ''}
              onPress={() => addressSheetRef.current?.open()}
              key="postalCode"
            />

            <Separator />

            <RowButton
              label="Country"
              value={safeUser.address?.country ?? ''}
              onPress={() => addressSheetRef.current?.open()}
              key="country"
            />
          </View>
        </LiquidGlassCard>
      </ScrollView>

      {/* ====== Bottom Sheets / Pickers ====== */}
      <CurrencyBottomSheet
        ref={currencySheetRef}
        selectedCurrency={safeUser.currency ?? 'USD'}
        onSave={(currency: string) => applyPatch({currency})}
      />

      <AddressBottomSheet
        ref={addressSheetRef}
        selectedAddress={safeUser.address ?? {}}
        onSave={(address) => applyPatch({address})}
      />

      <CountryMobileBottomSheet
        ref={phoneSheetRef}
        countries={COUNTRIES}
        selectedCountry={COUNTRIES.find(country => country.dial_code === parsedPhone.dialCode) ?? COUNTRIES.find((c: any) => c.code === 'US') ?? COUNTRIES[0]}
        mobileNumber={parsedPhone.localNumber}
        onSave={(country, phone) => applyPatch({phone: `${country.dial_code}${phone}`})}
      />

      <SimpleDatePicker
        value={
          safeUser.dateOfBirth ? new Date(safeUser.dateOfBirth) : null
        }
        onDateChange={date => {
          applyPatch({dateOfBirth: date ? date.toISOString().split('T')[0] : undefined});
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
  return (
    <View
      style={{
        borderBottomWidth: RNStyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.borderSeperator,
        marginLeft: 16,
      }}
    />
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
        numberOfLines={1}
        ellipsizeMode="tail">
        {value || ' '}
      </Text>
      <Image
        source={Images.rightArrow}
        style={styles.rowButtonArrow}
      />
    </TouchableOpacity>
  );
};

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
    profileName: {
      ...theme.typography.h4Alt,
      color: theme.colors.secondary,
      marginTop: theme.spacing[4],
    },
    profileEmail: {
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
      flexShrink: 1,
      flex: 1,
      textAlign: 'right',
    },
    rowButtonArrow: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
  });
