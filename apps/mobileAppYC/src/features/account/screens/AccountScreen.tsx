import React, {useState, useEffect} from 'react';
import {
  Image,
  ImageSourcePropType,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  BackHandler,
  Alert,
  Platform,
  ToastAndroid,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux'; // Import useSelector
import type {AppDispatch, RootState} from '@/app/store';

import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {selectAuthUser} from '@/features/auth/selectors';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {Images} from '@/assets/images';
import {useTheme} from '@/hooks';
import {useAuth} from '@/features/auth/context/AuthContext';
import {HomeStackParamList} from '@/navigation/types';
import {selectCompanions, setSelectedCompanion} from '@/features/companion';
import type {Companion} from '@/features/companion/types';
import type {ParentCompanionAccess} from '@/features/coParent';
import DeviceInfo from 'react-native-device-info';
import DeleteAccountBottomSheet, {
  type DeleteAccountBottomSheetRef,
} from '@/features/account/components/DeleteAccountBottomSheet';
import {AccountMenuList} from '@/features/account/components/AccountMenuList';
import {Header} from '@/shared/components/common/Header/Header';
import {calculateAgeFromDateOfBirth, truncateText} from '@/shared/utils/helpers';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';
import {deleteParentProfile} from '@/features/account/services/profileService';
import {
  deleteAmplifyAccount,
  deleteFirebaseAccount,
} from '@/features/auth/services/accountDeletion';
import {normalizeImageUri} from '@/shared/utils/imageUri';
import {usePreferences} from '@/features/preferences/PreferencesContext';
import {convertWeight} from '@/shared/utils/measurementSystem';

type Props = NativeStackScreenProps<HomeStackParamList, 'Account'>;

type CompanionProfile = {
  id: string;
  name: string;
  subtitle: string;
  avatar?: ImageSourcePropType;
  remoteUri?: string | null;
};

type MenuItem = {
  id: string;
  label: string;
  icon: ImageSourcePropType;
  onPress: () => void;
  danger?: boolean;
};

// Removed COMPANION_PLACEHOLDERS

const EMPTY_ACCESS_MAP: Record<string, ParentCompanionAccess> = {};

export const AccountScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const {logout, provider} = useAuth();
  const dispatch = useDispatch<AppDispatch>();
  const authUser = useSelector(selectAuthUser);
  const {weightUnit} = usePreferences();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const deleteSheetRef = React.useRef<DeleteAccountBottomSheetRef>(null);
  const [isDeleteSheetOpen, setIsDeleteSheetOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [failedProfileImages, setFailedProfileImages] = useState<Record<string, boolean>>({});
  const [appVersion, setAppVersion] = useState<string>('');
  const handleProfileImageError = React.useCallback((id: string) => {
    setFailedProfileImages(prev => {
      if (prev[id]) {
        return prev;
      }
      return {...prev, [id]: true};
    });
  }, []);

  // Get companions from the Redux store
  const companionsFromStore = useSelector(selectCompanions);
  const accessByCompanionId =
    useSelector((state: RootState) => state.coParent?.accessByCompanionId) ??
    EMPTY_ACCESS_MAP;
  const defaultAccess = useSelector((state: RootState) => state.coParent?.defaultAccess ?? null);
  const globalRole = useSelector((state: RootState) => state.coParent?.lastFetchedRole);
  const globalPermissions = useSelector(
    (state: RootState) => state.coParent?.lastFetchedPermissions,
  );

  const displayName = React.useMemo(() => {
    const composed = [authUser?.firstName, authUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (composed.length > 0) {
      return composed;
    }
    // Fallback to a generic name since COMPANION_PLACEHOLDERS is removed
    return authUser?.firstName?.trim() || 'You';
  }, [authUser?.firstName, authUser?.lastName]);

  const userInitials = React.useMemo(() => {
    if (authUser?.firstName) {
      return authUser.firstName.charAt(0).toUpperCase();
    }
    return displayName.charAt(0).toUpperCase();
  }, [authUser?.firstName, displayName]);

  const profiles = React.useMemo<CompanionProfile[]>(() => {
    const pluralSuffix = companionsFromStore.length === 1 ? '' : 's';
    const userRemoteUri = normalizeImageUri(
      authUser?.profilePicture ?? authUser?.profileToken ?? null,
    );
    // 1. User's Profile (Primary)
    const userProfile: CompanionProfile = {
      id: 'primary',
      name: displayName,
      subtitle: `${companionsFromStore.length} Companion${pluralSuffix}`,
      avatar: userRemoteUri ? {uri: userRemoteUri} : undefined,
      remoteUri: userRemoteUri,
    };

    // 2. Companions from Redux store
    const companionProfiles: CompanionProfile[] = companionsFromStore.map(
      (companion: Companion) => {
        // Calculate age and format the string
        let ageString: string | null = null;
        if (companion.dateOfBirth) {
          const age = calculateAgeFromDateOfBirth(companion.dateOfBirth);
          ageString = age > 0 ? `${age}Y` : null;
        }

        // Convert weight from kg (storage) to user's preferred unit
        let weightDisplay: string | null = null;
        if (companion.currentWeight) {
          let weight = companion.currentWeight;
          if (weightUnit === 'lbs') {
            weight = convertWeight(weight, 'kg', 'lbs');
          }
          weightDisplay = `${weight.toFixed(1)} ${weightUnit}`;
        }

        // Dynamically build the subtitle
        const subtitleParts = [
          companion.breed?.breedName,
          companion.gender,
          ageString, // Use the calculated age string here
          weightDisplay,
        ].filter(Boolean) as string[];

        const remoteUri = normalizeImageUri(companion.profileImage ?? null);

        return {
          id: companion.id,
          name: companion.name,
          subtitle: subtitleParts.join(' • '),
          avatar: remoteUri ? {uri: remoteUri} : undefined,
          remoteUri,
        };
      },
    );

    // 3. Combine them: User first, then companions
    return [userProfile, ...companionProfiles];
  }, [authUser?.profilePicture, authUser?.profileToken, companionsFromStore, displayName, weightUnit]); // Re-run when companions or weightUnit change

  const getInitial = (name: string, fallback: string) => {
    const trimmed = name?.trim();
    if (!trimmed) {
      return fallback;
    }
    return trimmed.charAt(0).toUpperCase();
  };

  const renderProfileAvatar = (profile: CompanionProfile, index: number) => {
    const isUserProfile = index === 0;
    const hasRemoteImage = Boolean(profile.remoteUri && profile.avatar);
    const shouldShowImage =
      hasRemoteImage && failedProfileImages[profile.id] !== true && profile.avatar;

    if (shouldShowImage) {
      return (
        <Image
          source={profile.avatar as ImageSourcePropType}
          style={styles.companionAvatar}
          onError={() => handleProfileImageError(profile.id)}
        />
      );
    }

    const initial = isUserProfile ? userInitials : getInitial(profile.name, 'C');

    return (
      <View style={styles.companionAvatarInitials}>
        <Text style={styles.avatarInitialsText}>{initial}</Text>
      </View>
    );
  };

  const handleBackPress = React.useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  const showPermissionToast = React.useCallback((label: string) => {
    const message = `You don't have access to ${label}. Ask the primary parent to enable it.`;
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Permission needed', message);
    }
  }, []);

  // Handle Android back button for delete bottom sheet
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isDeleteSheetOpen) {
        deleteSheetRef.current?.close();
        setIsDeleteSheetOpen(false);
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isDeleteSheetOpen]);

  useEffect(() => {
    const version = `${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`;
    setAppVersion(version);
  }, []);

  const handleDeletePress = React.useCallback(() => {
    setIsDeleteSheetOpen(true);
    deleteSheetRef.current?.open();
  }, []);

  const deriveDeletionErrorMessage = (error: unknown): string => {
    let baseMessage: string;
    if (error instanceof Error) {
      baseMessage = error.message;
    } else if (typeof error === 'string') {
      baseMessage = error;
    } else {
      baseMessage = 'Failed to delete your account. Please try again.';
    }

    const normalized = baseMessage.toLowerCase();
    if (
      normalized.includes('recent login') ||
      normalized.includes('requires-recent-login') ||
      normalized.includes('reauthenticate')
    ) {
      return 'For security reasons, please sign out, sign back in, and then try deleting your account again.';
    }

    return baseMessage || 'Failed to delete your account. Please try again.';
  };

  const handleDeleteAccount = React.useCallback(async () => {
    if (!authUser?.parentId) {
      throw new Error('Unable to delete account. Missing parent identifier.');
    }

    try {
      setIsDeletingAccount(true);
      const tokens = await getFreshStoredTokens();
      const accessToken = tokens?.accessToken;

      if (!accessToken || isTokenExpired(tokens?.expiresAt ?? undefined)) {
        throw new Error('Please sign in again before deleting your account.');
      }

      await deleteParentProfile(authUser.parentId, accessToken);

      if (provider === 'amplify') {
        await deleteAmplifyAccount();
      } else if (provider === 'firebase') {
        await deleteFirebaseAccount();
      }

      setIsDeleteSheetOpen(false);
      await logout();
    } catch (error) {
      const message = deriveDeletionErrorMessage(error);
      Alert.alert('Delete Failed', message);
      throw new Error(message);
    } finally {
      setIsDeletingAccount(false);
    }
  }, [authUser?.parentId, logout, provider]);

  const handleLogoutPress = React.useCallback(() => {
    logout().catch(error => {
      console.warn('[AccountScreen] Logout failed', error);
    });
  }, [logout]);

  const menuItems = React.useMemo<MenuItem[]>(
    () => [
      {
        id: 'faqs',
        label: 'FAQs',
        icon: Images.faqIcon,
        onPress: () => {
          navigation.navigate('FAQ');
        },
      },
      {
        id: 'about',
        label: 'About us',
        icon: Images.aboutusIcon,
        onPress: () => {
          Linking.openURL('https://www.yosemitecrew.com/about').catch(console.warn);
        },
      },
      {
        id: 'terms',
        label: 'Terms and Conditions',
        icon: Images.tncIcon,
        onPress: () => {
          navigation.navigate('TermsAndConditions');
        },
      },
      {
        id: 'privacy',
        label: 'Privacy Policy',
        icon: Images.privacyIcon,
        onPress: () => {
          navigation.navigate('PrivacyPolicy');
        },
      },
      {
        id: 'contact',
        label: 'Contact us',
        icon: Images.contactIcon,
        onPress: () => {
          navigation.navigate('ContactUs');
        },
      },
      {
        id: 'delete',
        label: 'Delete Account',
        icon: Images.deleteIconRed,
        danger: true,
        onPress: handleDeletePress,
      },
    ],
    [handleDeletePress, navigation],
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Account"
        showBackButton
        onBack={handleBackPress}
        onRightPress={() => {}}
      />
      <View style={styles.contentWrapper}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {/* Companion/Profile Card - Now uses 'profiles' from Redux data */}
          <LiquidGlassCard
            glassEffect="regular"
            interactive
            style={styles.companionsCard}
            fallbackStyle={styles.companionsCardFallback}>
            {profiles.map((profile, index) => (
              <View
                key={profile.id}
                style={[
                  styles.companionRow,
                  index < profiles.length - 1 && styles.companionRowDivider,
                ]}>
                <View style={styles.companionInfo}>
                  {renderProfileAvatar(profile, index)}
                  <View>
                    <Text
                      style={styles.companionName}
                      numberOfLines={1}
                      ellipsizeMode="tail">
                      {truncateText(profile.name, 18)}{' '}
                      {/* limit name to ~18 chars */}
                    </Text>
                    <Text
                      style={styles.companionMeta}
                      numberOfLines={1}
                      ellipsizeMode="tail">
                      {truncateText(profile.subtitle, 30)}{' '}
                      {/* limit subtitle to ~30 chars */}
                    </Text>
                  </View>
                </View>
                {/* Edit Button with conditional navigation */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.editButton}
                  onPress={() => {
                    // Index 0 is the primary user profile
                    if (index === 0) {
                      // Navigate to User Profile Edit screen
                      navigation.navigate('EditParentOverview', {
                        companionId: profile.id,
                      });
                      // e.g., navigation.navigate('EditUserProfile');
                    } else {
                      const access = accessByCompanionId[profile.id] ?? defaultAccess ?? null;
                      const role = (access?.role ?? globalRole ?? '').toUpperCase();
                      const isPrimary = role.includes('PRIMARY');
                      const permissions = access?.permissions ?? defaultAccess?.permissions ?? globalPermissions;
                      const canEdit =
                        isPrimary ||
                        (permissions ? Boolean(permissions.companionProfile) : false);
                      if (!canEdit) {
                        showPermissionToast('companion profile');
                        return;
                      }
                      dispatch(setSelectedCompanion(profile.id));
                      navigation.navigate('ProfileOverview', {
                        companionId: profile.id,
                      });
                    }
                  }}>
                  <Image source={Images.blackEdit} style={styles.editIcon} />
                </TouchableOpacity>
              </View>
            ))}
          </LiquidGlassCard>

          <LiquidGlassCard
            glassEffect="clear"
            interactive
            style={styles.menuContainer}
            fallbackStyle={styles.menuContainerFallback}>
            <AccountMenuList
              items={menuItems}
              rightArrowIcon={Images.rightArrow}
              onItemPress={(id: string) => {
                const it = menuItems.find(m => m.id === id);
                it?.onPress();
              }}
            />
          </LiquidGlassCard>

          <LiquidGlassButton
            title="Logout"
            onPress={handleLogoutPress}
            glassEffect="clear"
            interactive
            borderRadius="lg"
            forceBorder
            borderColor={theme.colors.secondary}
            style={styles.logoutButton}
            textStyle={styles.logoutText}
            leftIcon={
              <Image source={Images.logoutIcon} style={styles.logoutIcon} />
            }
          />
          {!!appVersion && (
            <Text style={styles.versionText}>Version {appVersion}</Text>
          )}
        </ScrollView>
      </View>

      <DeleteAccountBottomSheet
        ref={deleteSheetRef}
        email={authUser?.email}
        onDelete={handleDeleteAccount}
        isProcessing={isDeletingAccount}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentWrapper: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['4'],
      paddingBottom: theme.spacing['10'],
      gap: theme.spacing['5'],
    },
    companionsCard: {
      gap: theme.spacing['4'],
    },
    companionsCardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.white,
    },
    companionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing['2'],
      gap: theme.spacing['3'],
    },
    companionRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.borderSeperator,
      paddingBottom: theme.spacing['4'],
      marginBottom: theme.spacing['2'],
    },
    companionInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      flex: 1,
    },
    companionAvatar: {
      width: 56,
      height: 56,
      borderRadius: theme.borderRadius.full,
    },
    companionAvatarInitials: {
      width: 56,
      height: 56,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.lightBlueBackground,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    avatarInitialsText: {
      ...theme.typography.h4,
      color: theme.colors.secondary,
    },
    companionName: {
      ...theme.typography.h4,
      color: theme.colors.secondary,
    },
    companionMeta: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    editButton: {
      width: 32,
      height: 32,
      borderRadius: theme.borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(48, 47, 46, 0.12)',
    },
    editIcon: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
    menuContainer: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    menuContainerFallback: {
      borderRadius: theme.borderRadius.lg,
    },
    logoutButton: {
      width: '100%',
      height: 56,
      borderRadius: theme.borderRadius.lg,
    },
    logoutText: {
      ...theme.typography.button,
      color: theme.colors.secondary,
    },
    versionText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: theme.spacing['2'],
    },
    logoutIcon: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
      tintColor: theme.colors.secondary,
    },
  });
