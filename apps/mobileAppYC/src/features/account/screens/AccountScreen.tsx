import React, {useState, useEffect} from 'react';
import {
  Image,
  ImageSourcePropType,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
  BackHandler,
  Alert,
  Platform,
  ToastAndroid,
} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
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
import type {IconTileTone} from '@/shared/components/common/IconTile/IconTile';
import {Header} from '@/shared/components/common/Header/Header';
import {
  calculateAgeFromDateOfBirth,
  truncateText,
} from '@/shared/utils/helpers';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '@/features/auth/sessionManager';
import {deleteParentProfile} from '@/features/account/services/profileService';
import {deleteSupertokensAccount} from '@/features/auth/services/accountDeletion';
import {normalizeImageUri} from '@/shared/utils/imageUri';
import {usePreferences} from '@/features/preferences/PreferencesContext';
import {convertWeight} from '@/shared/utils/measurementSystem';

import i18next from 'i18next';
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
  tone?: IconTileTone;
  onPress: () => void;
  danger?: boolean;
  tintIcon?: boolean;
  /** Row leaves the app for a browser rather than opening an in-app screen. */
  external?: boolean;
};

// Removed COMPANION_PLACEHOLDERS

const EMPTY_ACCESS_MAP: Record<string, ParentCompanionAccess> = {};

const getInitial = (name: string, fallback: string) => {
  const trimmed = name?.trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.charAt(0).toUpperCase();
};

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

const buildAccountMenuItems = (
  navigation: Props['navigation'],
  onDeletePress: () => void,
): MenuItem[] => [
  {
    id: 'preferences',
    label: 'Preferences',
    icon: Images.editIconSlide,
    tone: 'info',
    onPress: () => {
      navigation.navigate('Preferences');
    },
  },
  {
    id: 'faqs',
    label: 'FAQs',
    icon: Images.faqIcon,
    tone: 'info',
    tintIcon: false,
    onPress: () => {
      navigation.navigate('FAQ');
    },
  },
  {
    id: 'about',
    label: 'About us',
    icon: Images.aboutusIcon,
    tone: 'indigo',
    // The only row here that leaves the app; every other one opens an in-app
    // screen, so the row says so rather than surprising the user.
    external: true,
    onPress: () => {
      Linking.openURL('https://www.yosemitecrew.com/about').catch(console.warn);
    },
  },
  {
    id: 'terms',
    label: 'Terms and Conditions',
    icon: Images.tncIcon,
    tone: 'violet',
    onPress: () => {
      navigation.navigate('TermsAndConditions');
    },
  },
  {
    id: 'privacy',
    label: 'Privacy Policy',
    icon: Images.privacyIcon,
    tone: 'violet',
    onPress: () => {
      navigation.navigate('PrivacyPolicy');
    },
  },
  {
    id: 'contact',
    label: 'Contact us',
    icon: Images.contactIcon,
    tone: 'success',
    onPress: () => {
      navigation.navigate('ContactUs');
    },
  },
  {
    id: 'delete',
    label: 'Delete Account',
    icon: Images.deleteIconRed,
    danger: true,
    onPress: onDeletePress,
  },
];

interface ProfileAvatarProps {
  profile: CompanionProfile;
  isUserProfile: boolean;
  failedProfileImages: Record<string, boolean>;
  userInitials: string;
  styles: ReturnType<typeof createStyles>;
  onImageError: (id: string) => void;
}

const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  profile,
  isUserProfile,
  failedProfileImages,
  userInitials,
  styles,
  onImageError,
}) => {
  const hasRemoteImage = Boolean(profile.remoteUri && profile.avatar);
  const shouldShowImage =
    hasRemoteImage &&
    failedProfileImages[profile.id] !== true &&
    profile.avatar;

  if (shouldShowImage) {
    return (
      <Image
        source={profile.avatar}
        style={styles.companionAvatar}
        onError={() => onImageError(profile.id)}
      />
    );
  }

  const initial = isUserProfile ? userInitials : getInitial(profile.name, 'C');

  // The parent's own avatar is blue everywhere else in the app - Home, Edit
  // parent, Create account. This row rendered it in the companion category
  // violet, so the same person appeared in two colours depending on screen.
  return (
    <View
      style={[
        styles.companionAvatarInitials,
        isUserProfile && styles.parentAvatarInitials,
      ]}>
      <Text
        style={[
          styles.avatarInitialsText,
          isUserProfile && styles.parentAvatarInitialsText,
        ]}>
        {initial}
      </Text>
    </View>
  );
};

interface CompanionProfilesCardProps {
  profiles: CompanionProfile[];
  styles: ReturnType<typeof createStyles>;
  failedProfileImages: Record<string, boolean>;
  userInitials: string;
  onProfileImageError: (id: string) => void;
  navigation: Props['navigation'];
  accessByCompanionId: Record<string, ParentCompanionAccess>;
  defaultAccess: ParentCompanionAccess | null;
  globalRole: ParentCompanionAccess['role'] | null | undefined;
  globalPermissions: ParentCompanionAccess['permissions'] | null | undefined;
  dispatch: AppDispatch;
  onPermissionDenied: (label: string) => void;
}

const CompanionProfilesCard: React.FC<CompanionProfilesCardProps> = ({
  profiles,
  styles,
  failedProfileImages,
  userInitials,
  onProfileImageError,
  navigation,
  accessByCompanionId,
  defaultAccess,
  globalRole,
  globalPermissions,
  dispatch,
  onPermissionDenied,
}) => (
  <View style={styles.cardShadowWrapper}>
    <LiquidGlassCard
      glassEffect="clear"
      interactive
      shadow="none"
      borderRadius="card"
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
            <ProfileAvatar
              profile={profile}
              isUserProfile={index === 0}
              failedProfileImages={failedProfileImages}
              userInitials={userInitials}
              styles={styles}
              onImageError={onProfileImageError}
            />
            <View style={styles.companionText}>
              <Text
                style={[
                  styles.companionName,
                  index === 0 && styles.companionNamePrimary,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail">
                {truncateText(profile.name, 18)} {/* limit name to ~18 chars */}
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
          <PressableOpacity
            activeOpacity={0.7}
            style={styles.editButton}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${profile.name}`}
            onPress={() => {
              // Index 0 is the primary user profile
              if (index === 0) {
                // Navigate to User Profile Edit screen
                navigation.navigate('EditParentOverview', {
                  companionId: profile.id,
                });
                // e.g., navigation.navigate('EditUserProfile');
              } else {
                const access =
                  accessByCompanionId[profile.id] ?? defaultAccess ?? null;
                const role = (access?.role ?? globalRole ?? '').toUpperCase();
                const isPrimary = role.includes('PRIMARY');
                const permissions =
                  access?.permissions ??
                  defaultAccess?.permissions ??
                  globalPermissions;
                const canEdit =
                  isPrimary ||
                  (permissions ? Boolean(permissions.companionProfile) : false);
                if (!canEdit) {
                  onPermissionDenied('companion profile');
                  return;
                }
                dispatch(setSelectedCompanion(profile.id));
                navigation.navigate('ProfileOverview', {
                  companionId: profile.id,
                });
              }
            }}>
            <Image source={Images.blackEdit} style={styles.editIcon} />
          </PressableOpacity>
        </View>
      ))}
    </LiquidGlassCard>
  </View>
);

interface AccountMenuCardProps {
  styles: ReturnType<typeof createStyles>;
  menuItems: MenuItem[];
}

const AccountMenuCard: React.FC<AccountMenuCardProps> = ({
  styles,
  menuItems,
}) => (
  <View style={styles.cardShadowWrapper}>
    <LiquidGlassCard
      glassEffect="clear"
      interactive
      shadow="none"
      borderRadius="card"
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
  </View>
);

interface AccountFooterActionsProps {
  styles: ReturnType<typeof createStyles>;
  appVersion: string;
  dividerColor: string;
  onLogout: () => void;
}

const AccountFooterActions: React.FC<AccountFooterActionsProps> = ({
  styles,
  appVersion,
  dividerColor,
  onLogout,
}) => (
  <>
    <LiquidGlassButton
      title="Log out"
      onPress={onLogout}
      glassEffect="clear"
      interactive
      borderRadius="button"
      forceBorder
      borderColor={dividerColor}
      shadowIntensity="none"
      leftIcon={<Image source={Images.logoutIcon} style={styles.logoutIcon} />}
      style={styles.logoutButton}
      textStyle={styles.logoutText}
    />
    {!!appVersion && (
      <Text style={styles.versionText}>Version {appVersion}</Text>
    )}
  </>
);

export const AccountScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const {logout} = useAuth();
  const dispatch = useDispatch<AppDispatch>();
  const authUser = useSelector(selectAuthUser);
  const {weightUnit} = usePreferences();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const deleteSheetRef = React.useRef<DeleteAccountBottomSheetRef>(null);
  const isDeleteSheetOpenRef = React.useRef(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [failedProfileImages, setFailedProfileImages] = useState<
    Record<string, boolean>
  >({});
  const [appVersion] = useState<string>(
    () => `${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`,
  );
  const handleProfileImageError = React.useCallback((id: string) => {
    setFailedProfileImages(prev => {
      return {...prev, [id]: true};
    });
  }, []);

  // Get companions from the Redux store
  const companionsFromStore = useSelector(selectCompanions);
  const accessByCompanionId =
    useSelector((state: RootState) => state.coParent?.accessByCompanionId) ??
    EMPTY_ACCESS_MAP;
  const defaultAccess = useSelector(
    (state: RootState) => state.coParent?.defaultAccess ?? null,
  );
  const globalRole = useSelector(
    (state: RootState) => state.coParent?.lastFetchedRole,
  );
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

        let weightDisplay: string | null = null;
        if (companion.currentWeight) {
          const displayWeight = convertWeight(
            companion.currentWeight,
            'kg',
            weightUnit,
          );
          weightDisplay = `${displayWeight.toFixed(1)} ${weightUnit}`;
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
  }, [
    authUser?.profilePicture,
    authUser?.profileToken,
    companionsFromStore,
    displayName,
    weightUnit,
  ]); // Re-run when companions or weightUnit change

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
      Alert.alert(i18next.t('alerts.shared.permissionNeeded'), message);
    }
  }, []);

  // Handle Android back button for delete bottom sheet
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isDeleteSheetOpenRef.current) {
          deleteSheetRef.current?.close();
          isDeleteSheetOpenRef.current = false;
          return true;
        }
        return false;
      },
    );

    return () => backHandler.remove();
  }, []);

  const handleDeletePress = React.useCallback(() => {
    isDeleteSheetOpenRef.current = true;
    deleteSheetRef.current?.open();
  }, []);

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

      await deleteSupertokensAccount();

      isDeleteSheetOpenRef.current = false;
      await logout();
    } catch (error) {
      const message = deriveDeletionErrorMessage(error);
      Alert.alert(i18next.t('alerts.account.deleteFailed'), message);
      throw new Error(message);
    } finally {
      setIsDeletingAccount(false);
    }
  }, [authUser?.parentId, logout]);

  const handleLogoutPress = React.useCallback(() => {
    logout().catch(error => {
      console.warn('[AccountScreen] Logout failed', error);
    });
  }, [logout]);

  const menuItems = React.useMemo<MenuItem[]>(
    () => buildAccountMenuItems(navigation, handleDeletePress),
    [handleDeletePress, navigation],
  );

  return (
    <>
      <LiquidGlassHeaderScreen
        header={
          <Header
            title="Account"
            showBackButton
            onBack={handleBackPress}
            glass={false}
          />
        }
        contentPadding={theme.spacing['4']}
        cardGap={theme.spacing['4']}
        useSafeAreaView
        containerStyle={styles.container}
        showBottomFade={false}>
        {contentPaddingStyle => (
          <View style={styles.contentWrapper}>
            <ScrollView
              contentContainerStyle={[styles.content, contentPaddingStyle]}
              showsVerticalScrollIndicator={false}>
              {/* Companion/Profile Card - Now uses 'profiles' from Redux data */}
              <CompanionProfilesCard
                profiles={profiles}
                styles={styles}
                failedProfileImages={failedProfileImages}
                userInitials={userInitials}
                onProfileImageError={handleProfileImageError}
                navigation={navigation}
                accessByCompanionId={accessByCompanionId}
                defaultAccess={defaultAccess}
                globalRole={globalRole}
                globalPermissions={globalPermissions}
                dispatch={dispatch}
                onPermissionDenied={showPermissionToast}
              />

              <AccountMenuCard styles={styles} menuItems={menuItems} />

              <AccountFooterActions
                styles={styles}
                appVersion={appVersion}
                dividerColor={theme.colors.divider}
                onLogout={handleLogoutPress}
              />
            </ScrollView>
          </View>
        )}
      </LiquidGlassHeaderScreen>

      <DeleteAccountBottomSheet
        ref={deleteSheetRef}
        email={authUser?.email}
        onDelete={handleDeleteAccount}
        isProcessing={isDeletingAccount}
      />
    </>
  );
};

const createStyles = (theme: any) => {
  return StyleSheet.create({
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
      paddingTop: theme.spacing['6'],
      paddingBottom: theme.spacing['24'],
      gap: theme.spacing['4'],
    },
    companionsCard: {
      backgroundColor: theme.colors.screen2,
      borderRadius: theme.borderRadius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['1'],
      overflow: 'hidden',
    },
    companionsCardFallback: {
      backgroundColor: theme.colors.screen2,
      borderRadius: theme.borderRadius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      overflow: 'hidden',
    },
    companionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing['3.5'],
      gap: theme.spacing['3'],
    },
    companionRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.hairline,
    },
    companionInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      flex: 1,
    },
    companionText: {
      flex: 1,
      minWidth: 0,
    },
    companionAvatar: {
      width: theme.spacing['14'],
      height: theme.spacing['14'],
      borderRadius: theme.borderRadius.full,
    },
    companionAvatarInitials: {
      width: theme.spacing['14'],
      height: theme.spacing['14'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.avatarVioletBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitialsText: {
      ...theme.typography.h4,
      color: theme.colors.avatarVioletInk,
    },
    parentAvatarInitials: {
      backgroundColor: theme.colors.blueSoft,
    },
    parentAvatarInitialsText: {
      color: theme.colors.blueText,
    },
    companionName: {
      ...theme.typography.titleSmall,
      color: theme.colors.inkBody,
    },
    companionNamePrimary: {
      ...theme.typography.serifTitleSmall,
      color: theme.colors.ink,
    },
    companionMeta: {
      ...theme.typography.body13,
      color: theme.colors.inkFaint,
    },
    editButton: {
      width: theme.spacing['10'],
      height: theme.spacing['10'],
      borderRadius: theme.borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
    },
    editIcon: {
      width: theme.spacing['4.5'],
      height: theme.spacing['4.5'],
      resizeMode: 'contain',
      tintColor: theme.colors.inkBody,
    },
    menuContainer: {
      backgroundColor: theme.colors.screen2,
      borderRadius: theme.borderRadius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      overflow: 'hidden',
    },
    menuContainerFallback: {
      backgroundColor: theme.colors.screen2,
      borderRadius: theme.borderRadius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      overflow: 'hidden',
    },
    logoutButton: {
      width: '100%',
      height: theme.spacing['14'],
      borderRadius: theme.borderRadius.button,
    },
    logoutIcon: {
      width: theme.spacing['4.5'],
      height: theme.spacing['4.5'],
      resizeMode: 'contain',
      tintColor: theme.colors.inkBody,
    },
    logoutText: {
      ...theme.typography.button,
      color: theme.colors.inkBody,
    },
    versionText: {
      ...theme.typography.body12,
      color: theme.colors.inkMuted,
      textAlign: 'center',
      marginTop: theme.spacing['2'],
    },
    cardShadowWrapper: {
      borderRadius: theme.borderRadius.card,
      backgroundColor: theme.colors.screen2,
      ...theme.shadows.card,
      overflow: 'visible',
    },
  });
};
