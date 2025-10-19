import React from 'react';
import {
  Image,
  ImageSourcePropType,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSelector} from 'react-redux'; // Import useSelector

import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {selectAuthUser} from '@/features/auth/selectors';
import {LiquidGlassCard} from '@/components/common/LiquidGlassCard/LiquidGlassCard';
import {Images} from '@/assets/images';
import {useTheme} from '@/hooks';
import {useAuth} from '@/contexts/AuthContext';
import {HomeStackParamList} from '@/navigation/types';
import {selectCompanions} from '@/features/companion'; // Import the selector
import type {Companion} from '@/features/companion/types'; // Import Companion type

import DeleteAccountBottomSheet, {
  type DeleteAccountBottomSheetRef,
} from './components/DeleteAccountBottomSheet';
import {AccountMenuList} from './components/AccountMenuList';
import {Header} from '@/components';
import {calculateAgeFromDateOfBirth, truncateText} from '@/utils/helpers';

type Props = NativeStackScreenProps<HomeStackParamList, 'Account'>;

type CompanionProfile = {
  id: string;
  name: string;
  subtitle: string;
  avatar: ImageSourcePropType;
};

type MenuItem = {
  id: string;
  label: string;
  icon: ImageSourcePropType;
  onPress: () => void;
  danger?: boolean;
};

// Removed COMPANION_PLACEHOLDERS

export const AccountScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const {logout} = useAuth();
  const authUser = useSelector(selectAuthUser);
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const deleteSheetRef = React.useRef<DeleteAccountBottomSheetRef>(null);

  // Get companions from the Redux store
  const companionsFromStore = useSelector(selectCompanions);

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



  const primaryAvatar: ImageSourcePropType = React.useMemo(() => {
    if (authUser?.profilePicture) {
      return {uri: authUser.profilePicture};
    }
    if (authUser?.profileToken) {
      return {uri: authUser.profileToken};
    }
    // Use a generic placeholder image if no URL is available
    return Images.cat;
  }, [authUser?.profilePicture, authUser?.profileToken]);

  const userInitials = React.useMemo(() => {
    if (authUser?.firstName) {
      return authUser.firstName.charAt(0).toUpperCase();
    }
    return displayName.charAt(0).toUpperCase();
  }, [authUser?.firstName, displayName]);

  const profiles = React.useMemo<CompanionProfile[]>(() => {
    // 1. User's Profile (Primary)
    const userProfile: CompanionProfile = {
      id: 'primary',
      name: displayName,
      subtitle: `${companionsFromStore.length} Companion${
        companionsFromStore.length !== 1 ? 's' : ''
      }`,
      avatar: primaryAvatar,
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

        // Dynamically build the subtitle
        const subtitleParts = [
          companion.breed?.breedName,
          companion.gender,
          ageString, // Use the calculated age string here
          companion.currentWeight ? `${companion.currentWeight} kgs` : null,
        ].filter(Boolean) as string[];

        return {
          id: companion.id,
          name: companion.name,
          subtitle: subtitleParts.join(' • '),
          avatar: companion.profileImage
            ? {uri: companion.profileImage}
            : Images.cat, // Use a default companion avatar
        };
      },
    );

    // 3. Combine them: User first, then companions
    return [userProfile, ...companionProfiles];
  }, [displayName, primaryAvatar, companionsFromStore]); // Re-run when companions change

  const handleBackPress = React.useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  const handleDeletePress = React.useCallback(() => {
    deleteSheetRef.current?.open();
  }, []);

  const handleDeleteAccount = React.useCallback(async () => {
    await logout();
  }, [logout]);

  const menuItems = React.useMemo<MenuItem[]>(
    () => [
      {
        id: 'faqs',
        label: 'FAQs',
        icon: Images.faqIcon,
        onPress: () => {},
      },
      {
        id: 'about',
        label: 'About us',
        icon: Images.aboutusIcon,
        onPress: () => {},
      },
      {
        id: 'terms',
        label: 'Terms and Conditions',
        icon: Images.tncIcon,
        onPress: () => {},
      },
      {
        id: 'privacy',
        label: 'Privacy Policy',
        icon: Images.privacyIcon,
        onPress: () => {},
      },
      {
        id: 'contact',
        label: 'Contact us',
        icon: Images.contactIcon,
        onPress: () => {},
      },
      {
        id: 'delete',
        label: 'Delete Account',
        icon: Images.deleteIconRed,
        danger: true,
        onPress: handleDeletePress,
      },
    ],
    [handleDeletePress],
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Account"
        showBackButton
        onBack={handleBackPress}
        rightIcon={Images.notificationIcon}
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
                  {index === 0 && authUser?.profilePicture == null ? (
                    <View style={styles.companionAvatarInitials}>
                      <Text style={styles.avatarInitialsText}>
                        {userInitials}
                      </Text>
                    </View>
                  ) : (
                    <Image
                      source={profile.avatar}
                      style={styles.companionAvatar}
                    />
                  )}
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
                      // Navigate to Companion Profile Overview
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
              onItemPress={id => {
                const it = menuItems.find(m => m.id === id);
                it?.onPress();
              }}
            />
          </LiquidGlassCard>

          <LiquidGlassButton
            title="Logout"
            onPress={logout}
            glassEffect="clear"
            interactive
            tintColor={theme.colors.surface}
            borderRadius="lg"
            forceBorder
            borderColor={theme.colors.secondary}
            style={styles.logoutButton}
            textStyle={styles.logoutText}
            leftIcon={
              <Image source={Images.logoutIcon} style={styles.logoutIcon} />
            }
          />
        </ScrollView>
      </View>

      <DeleteAccountBottomSheet
        ref={deleteSheetRef}
        email={authUser?.email}
        onDelete={handleDeleteAccount}
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
    logoutIcon: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
      tintColor: theme.colors.secondary,
    },
  });
