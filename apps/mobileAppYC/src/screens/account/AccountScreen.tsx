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

import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {LiquidGlassCard} from '@/components/common/LiquidGlassCard/LiquidGlassCard';
import {Images} from '@/assets/images';
import {useTheme} from '@/hooks';
import {useAuth} from '@/contexts/AuthContext';
import {HomeStackParamList} from '@/navigation/types';

import DeleteAccountBottomSheet, {
  type DeleteAccountBottomSheetRef,
} from './components/DeleteAccountBottomSheet';
import {AccountMenuList} from './components/AccountMenuList';
import {Header} from '@/components';

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

const COMPANION_PLACEHOLDERS: CompanionProfile[] = [
  {
    id: 'primary',
    name: 'Sky B',
    subtitle: '2 Companions',
    avatar: {
      uri: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=160&h=160',
    },
  },
  {
    id: 'kizie',
    name: 'Kizie',
    subtitle: 'Beagle • 3Y • 28 lbs',
    avatar: {
      uri: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=160&h=160',
    },
  },
  {
    id: 'oscar',
    name: 'Oscar',
    subtitle: 'Egyptian Mau • Male • 2Y • 12 lbs',
    avatar: {
      uri: 'https://images.unsplash.com/photo-1517423568366-8b83523034fd?auto=format&fit=crop&w=160&h=160',
    },
  },
];

export const AccountScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const {user, logout} = useAuth();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const deleteSheetRef = React.useRef<DeleteAccountBottomSheetRef>(null);

  const displayName = React.useMemo(() => {
    const composed = [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (composed.length > 0) {
      return composed;
    }
    if (user?.firstName?.trim()) {
      return user.firstName.trim();
    }
    return COMPANION_PLACEHOLDERS[0]?.name ?? 'You';
  }, [user?.firstName, user?.lastName]);

  const hasValidAvatar = React.useMemo(() => {
    const profilePic = user?.profilePicture;
    const profileToken = user?.profileToken;

    // Check if profilePicture is a valid HTTP/HTTPS URL
    if (
      profilePic &&
      (profilePic.startsWith('http://') || profilePic.startsWith('https://'))
    ) {
      return true;
    }

    // Check if profileToken is a valid HTTP/HTTPS URL
    if (
      profileToken &&
      (profileToken.startsWith('http://') ||
        profileToken.startsWith('https://'))
    ) {
      return true;
    }

    return false;
  }, [user?.profilePicture, user?.profileToken]);

  const primaryAvatar: ImageSourcePropType = React.useMemo(() => {
    if (user?.profilePicture) {
      return {uri: user.profilePicture};
    }
    if (user?.profileToken) {
      return {uri: user.profileToken};
    }
    return COMPANION_PLACEHOLDERS[0]?.avatar;
  }, [user?.profilePicture, user?.profileToken]);

  const userInitials = React.useMemo(() => {
    if (user?.firstName) {
      return user.firstName.charAt(0).toUpperCase();
    }
    return displayName.charAt(0).toUpperCase();
  }, [user?.firstName, displayName]);

  const companions = React.useMemo<CompanionProfile[]>(() => {
    if (!COMPANION_PLACEHOLDERS.length) {
      return [];
    }
    return COMPANION_PLACEHOLDERS.map((profile, index) =>
      index === 0
        ? {
            ...profile,
            name: displayName,
            avatar: primaryAvatar,
          }
        : profile,
    );
  }, [displayName, primaryAvatar]);

  const handleBackPress = React.useCallback(() => {
    // Use goBack to properly pop the screen from the stack
    // This ensures the tab bar reappears correctly
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

          <LiquidGlassCard
            glassEffect="clear"
            interactive
            style={styles.companionsCard}
            fallbackStyle={styles.companionsCardFallback}>
            {companions.map((companion, index) => (
              <View
                key={companion.id}
                style={[
                  styles.companionRow,
                  index < companions.length - 1 && styles.companionRowDivider,
                ]}>
                <View style={styles.companionInfo}>
                  {index === 0 && !hasValidAvatar ? (
                    <View style={styles.companionAvatarInitials}>
                      <Text style={styles.avatarInitialsText}>
                        {userInitials}
                      </Text>
                    </View>
                  ) : (
                    <Image
                      source={companion.avatar}
                      style={styles.companionAvatar}
                    />
                  )}
                  <View>
                    <Text style={styles.companionName}>{companion.name}</Text>
                    <Text style={styles.companionMeta}>
                      {companion.subtitle}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity activeOpacity={0.7} style={styles.editButton}>
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
        email={user?.email}
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
