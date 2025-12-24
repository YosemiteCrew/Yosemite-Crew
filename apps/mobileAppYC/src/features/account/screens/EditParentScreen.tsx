import React, {useMemo, useRef, useState, useCallback, useEffect} from 'react';
import {
  Alert,
  View,
  Text,
  ScrollView,
  StyleSheet,
  BackHandler,
  TouchableOpacity,
  Image,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {Images} from '@/assets/images';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';

import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from '@/app/store';

import {Header} from '@/shared/components/common/Header/Header';
import {GifLoader} from '@/shared/components/common';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {LiquidGlassHeader} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeader';
import {useTheme} from '@/hooks';
import {createFormScreenStyles} from '@/shared/utils/formScreenStyles';
import {createGlassCardStyles, createLiquidGlassHeaderStyles} from '@/shared/utils/screenStyles';
import {Separator, RowButton} from '@/shared/components/common/FormRowComponents';

import {
  selectAuthUser,
  selectAuthIsLoading,
} from '@/features/auth/selectors';

import type {HomeStackParamList} from '@/navigation/types';

// Reusable inline editor
import {InlineEditRow} from '@/shared/components/common/InlineEditRow/InlineEditRow';
import COUNTRIES from '@/shared/utils/countryList.json';

// Bottom sheets
import {
  CurrencyBottomSheet,
  type CurrencyBottomSheetRef,
} from '@/shared/components/common/CurrencyBottomSheet/CurrencyBottomSheet';
import {
  AddressBottomSheet,
  type AddressBottomSheetRef,
} from '@/shared/components/common/AddressBottomSheet/AddressBottomSheet';
import {
  CountryMobileBottomSheet,
  type CountryMobileBottomSheetRef,
} from '@/shared/components/common/CountryMobileBottomSheet/CountryMobileBottomSheet';

// Date picker (reuse same component & formatter)
import {
  SimpleDatePicker,
  formatDateForDisplay,
} from '@/shared/components/common/SimpleDatePicker/SimpleDatePicker';

// Profile Image Picker Header
import {UserProfileHeader} from '@/features/account/components/UserProfileHeader';
import type {ProfileImagePickerRef} from '@/shared/components/common/ProfileImagePicker/ProfileImagePicker';

// Types
import type {User} from '@/features/auth/types';
import {updateUserProfile} from '@/features/auth';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';
import {
  updateParentProfile,
  type ParentProfileUpsertPayload,
} from '@/features/account/services/profileService';
import {preparePhotoPayload} from '@/features/account/utils/profilePhoto';
import {
  requestParentProfileUploadUrl,
  uploadFileToPresignedUrl,
} from '@/shared/services/uploadService';

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
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = useState(0);

  const user = useSelector(selectAuthUser);
  const isLoading = useSelector(selectAuthIsLoading);

  // Local UI state
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Bottom sheet refs
  const currencySheetRef = useRef<CurrencyBottomSheetRef>(null);
  const addressSheetRef = useRef<AddressBottomSheetRef>(null);
  const phoneSheetRef = useRef<CountryMobileBottomSheetRef>(null);

  // Profile image picker ref
  const profileImagePickerRef = useRef<ProfileImagePickerRef | null>(null);

  // Track which bottom sheet is open
  const [openBottomSheet, setOpenBottomSheet] = useState<'currency' | 'address' | 'phone' | null>(null);

  // Helpers
  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const safeUser = user as User;

  useEffect(() => {
    let mounted = true;
    getFreshStoredTokens()
      .then(tokens => {
        if (mounted) {
          const nextToken =
            tokens && !isTokenExpired(tokens.expiresAt ?? undefined)
              ? tokens.accessToken ?? null
              : null;
          setAccessToken(nextToken);
        }
      })
      .catch(error => {
        console.warn('[EditParent] Failed to load stored tokens', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const syncParentProfile = useCallback(
    async (nextUser: User) => {
      if (!accessToken) {
        console.warn('[EditParent] No access token available; skipping remote sync.');
        return;
      }

      if (!nextUser.parentId) {
        console.warn('[EditParent] Missing parent identifier; skipping remote sync.');
        return;
      }

      try {
        const photoPayload = await preparePhotoPayload({
          imageUri: nextUser.profilePicture ?? null,
          existingRemoteUrl: nextUser.profileToken ?? null,
        });

        let profileImageKey: string | null = null;
        let existingPhotoUrl = photoPayload.remoteUrl ?? null;

        if (photoPayload.localFile) {
          const presigned = await requestParentProfileUploadUrl({
            accessToken,
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

        const hasAddress =
          nextUser.address?.addressLine ||
          nextUser.address?.city ||
          nextUser.address?.stateProvince ||
          nextUser.address?.postalCode ||
          nextUser.address?.country;

        const payload: ParentProfileUpsertPayload = {
          parentId: nextUser.parentId,
          firstName: (nextUser.firstName ?? '').trim(),
          lastName: nextUser.lastName?.trim(),
          phoneNumber: nextUser.phone ?? '',
          email: nextUser.email,
          dateOfBirth: nextUser.dateOfBirth ?? null,
          address: hasAddress
            ? {
                addressLine: nextUser.address?.addressLine?.trim(),
                stateProvince: nextUser.address?.stateProvince?.trim(),
                city: nextUser.address?.city?.trim(),
                postalCode: nextUser.address?.postalCode?.trim(),
                country: nextUser.address?.country?.trim(),
              }
            : undefined,
          isProfileComplete: nextUser.profileCompleted ?? undefined,
          profileImageKey,
          existingPhotoUrl,
        };

        const summary = await updateParentProfile(payload, accessToken);

        const remotePatch: Partial<User> = {};
        if (summary.profileImageUrl) {
          remotePatch.profileToken = summary.profileImageUrl;
          remotePatch.profilePicture = summary.profileImageUrl;
        }
        if (summary.isComplete !== undefined) {
          remotePatch.profileCompleted = summary.isComplete;
        }
        if (summary.birthDate) {
          remotePatch.dateOfBirth = summary.birthDate;
        }
        if (summary.phoneNumber) {
          remotePatch.phone = summary.phoneNumber;
        }
        if (summary.address) {
          remotePatch.address = {
            addressLine: summary.address.addressLine,
            city: summary.address.city,
            stateProvince: summary.address.state,
            postalCode: summary.address.postalCode,
            country: summary.address.country,
          };
        }

        if (Object.keys(remotePatch).length > 0) {
          dispatch(updateUserProfile(remotePatch));
        }
      } catch (error) {
        console.error('[EditParent] Failed to sync parent profile', error);
      }
    },
    [accessToken, dispatch],
  );

  const applyPatch = useCallback(
    (patch: Partial<User>) => {
      if (!safeUser) {
        return;
      }

      const mergedAddress =
        patch.address === undefined
          ? safeUser.address
          : {...safeUser.address, ...patch.address};

      const nextUser: User = {
        ...safeUser,
        ...patch,
        address: mergedAddress,
      };

      dispatch(updateUserProfile(patch));
      syncParentProfile(nextUser);
    },
    [dispatch, safeUser, syncParentProfile],
  );

  // Parse phone number to separate dial code and local number
  const parsedPhone = useMemo(() => {
    if (!safeUser.phone) return { dialCode: '+1', localNumber: '' };
    const rawPhone = safeUser.phone.replaceAll(/[^0-9+]/g, '');
    const normalizedPhoneDigits = rawPhone.replaceAll(/\D/g, '');
    let resolvedCountry = COUNTRIES.find(country => country.code === 'US') ?? COUNTRIES[0];
    if (normalizedPhoneDigits) {
      const match = COUNTRIES.find(country => {
        const dialCodeDigits = country.dial_code.replaceAll('+', '');
        return normalizedPhoneDigits.startsWith(dialCodeDigits);
      });
      if (match) resolvedCountry = match;
    }
    const localPhoneRaw = normalizedPhoneDigits.startsWith(
      resolvedCountry.dial_code.replaceAll('+', ''),
    )
      ? normalizedPhoneDigits.slice(
          resolvedCountry.dial_code.replaceAll('+', '').length,
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
          case 'currency':
            currencySheetRef.current?.close();
            break;
          case 'address':
            addressSheetRef.current?.close();
            break;
          case 'phone':
            phoneSheetRef.current?.close();
            break;
        }
        setOpenBottomSheet(null);
        return true;
      }

      return false;
    });

    return () => backHandler.remove();
  }, [showDobPicker, openBottomSheet]);

  if (!safeUser) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Parent" showBackButton onBack={goBack} />
        <View style={styles.centered}>
          {isLoading ? (
            <GifLoader />
          ) : (
            <Text style={styles.muted}>User not found.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top']}>
      <LiquidGlassHeader
        insetsTop={insets.top}
        currentHeight={topGlassHeight}
        onHeightChange={setTopGlassHeight}
        topSectionStyle={styles.topSection}
        shadowWrapperStyle={styles.topGlassShadowWrapper}
        cardStyle={styles.topGlassCard}
        fallbackStyle={styles.topGlassFallback}>
        <Header title="Parent" showBackButton onBack={goBack} glass={false} />
      </LiquidGlassHeader>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          topGlassHeight
            ? {paddingTop: Math.max(0, topGlassHeight - insets.top) + theme.spacing['3']}
            : null,
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Header block with profile image picker */}
        <UserProfileHeader
          firstName={safeUser.firstName ?? ''}
          lastName={safeUser.lastName ?? ''}
          profileImage={safeUser.profilePicture}
          pickerRef={profileImagePickerRef}
          onImageSelected={handleProfileImageChange}
          size={100}
          showCameraButton
        />

        {/* Card with rows */}
        <View style={styles.glassShadowWrapper}>
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
              onPress={() => {
                setOpenBottomSheet('phone');
                phoneSheetRef.current?.open();
              }}
            />

            <Separator />

            {/* Email – Read only */}
            <View style={styles.readOnlyEmailRow}>
              <Text style={styles.rowButtonLabel}>Email</Text>
              <Text
                style={styles.rowButtonValue}
                numberOfLines={1}
                ellipsizeMode="tail">
                {safeUser.email ?? '—'}
              </Text>
              <TouchableOpacity
                style={styles.copyIconButton}
                activeOpacity={0.7}
                onPress={() => {
                  const email = safeUser.email?.trim();
                  if (!email) {
                    return;
                  }
                  Clipboard.setString(email);
                  Alert.alert('Copied', 'Email Id copied to clipboard');
                }}>
                <Image source={Images.copyIcon} style={styles.copyIcon} />
              </TouchableOpacity>
            </View>

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
              onPress={() => {
                setOpenBottomSheet('currency');
                currencySheetRef.current?.open();
              }}
            />

            <Separator />

            {/* Address – Multiple rows, all opening AddressBottomSheet */}
            <RowButton
              label="Address"
              value={safeUser.address?.addressLine ?? ''}
              onPress={() => {
                setOpenBottomSheet('address');
                addressSheetRef.current?.open();
              }}
              key="address"
            />

            <Separator />

            <RowButton
              label="State/Province"
              value={safeUser.address?.stateProvince ?? ''}
              onPress={() => {
                setOpenBottomSheet('address');
                addressSheetRef.current?.open();
              }}
              key="stateProvince"
            />

            <Separator />

            <RowButton
              label="City"
              value={safeUser.address?.city ?? ''}
              onPress={() => {
                setOpenBottomSheet('address');
                addressSheetRef.current?.open();
              }}
              key="city"
            />

            <Separator />

            <RowButton
              label="Postal Code"
              value={safeUser.address?.postalCode ?? ''}
              onPress={() => {
                setOpenBottomSheet('address');
                addressSheetRef.current?.open();
              }}
              key="postalCode"
            />

            <Separator />

            <RowButton
              label="Country"
              value={safeUser.address?.country ?? ''}
              onPress={() => {
                setOpenBottomSheet('address');
                addressSheetRef.current?.open();
              }}
              key="country"
            />
            </View>
          </LiquidGlassCard>
        </View>
      </ScrollView>

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

      {/* ====== Bottom Sheets ====== */}
      <CurrencyBottomSheet
        ref={currencySheetRef}
        selectedCurrency={safeUser.currency ?? 'USD'}
        onSave={(currency: string) => {
          applyPatch({currency});
          setOpenBottomSheet(null);
        }}
      />

      <AddressBottomSheet
        ref={addressSheetRef}
        selectedAddress={safeUser.address ?? {}}
        onSave={(address) => {
          applyPatch({address});
          setOpenBottomSheet(null);
        }}
      />

      <CountryMobileBottomSheet
        ref={phoneSheetRef}
        countries={COUNTRIES}
        selectedCountry={COUNTRIES.find(country => country.dial_code === parsedPhone.dialCode) ?? COUNTRIES.find((c: any) => c.code === 'US') ?? COUNTRIES[0]}
        mobileNumber={parsedPhone.localNumber}
        onSave={(country, phone) => {
          applyPatch({phone: `${country.dial_code}${phone}`});
          setOpenBottomSheet(null);
        }}
      />
    </>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    ...createFormScreenStyles(theme),
    ...createLiquidGlassHeaderStyles(theme),
    ...createGlassCardStyles(theme),
    readOnlyEmailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['3'],
    },
    rowButtonLabel: {
      ...theme.typography.pillSubtitleBold15,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    rowButtonValue: {
      ...theme.typography.pillSubtitleBold15,
      color: theme.colors.placeholder,
      marginRight: theme.spacing['2'],
      flexShrink: 1,
      flex: 1,
      textAlign: 'right',
    },
    copyIconButton: {
      paddingLeft: theme.spacing['1'],
      paddingVertical: theme.spacing['1'],
    },
    copyIcon: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
  });
