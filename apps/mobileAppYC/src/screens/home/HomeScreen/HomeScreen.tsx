import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NavigationProp} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '@/hooks';
import {HomeStackParamList, TabParamList} from '@/navigation/types';
import {useAuth} from '@/contexts/AuthContext';
import {Images} from '@/assets/images';
import {SearchBar, YearlySpendCard} from '@/components/common';
import {LiquidGlassCard} from '@/components/common/LiquidGlassCard/LiquidGlassCard';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {
  selectCompanions,
  selectSelectedCompanionId,
  setSelectedCompanion,
  fetchCompanions,
} from '@/features/companion';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

const QUICK_ACTIONS = [
  {id: 'health', label: 'Manage health', icon: Images.healthIcon},
  {id: 'hygiene', label: 'Hygiene maintenance', icon: Images.hygeineIcon},
  {id: 'diet', label: 'Dietary plans', icon: Images.dietryIcon},
];

export const deriveHomeGreetingName = (rawFirstName?: string | null) => {
  const trimmed = rawFirstName?.trim() ?? '';
  const resolvedName = trimmed.length > 0 ? trimmed : 'Sky';
  const displayName =
    resolvedName.length > 13
      ? `${resolvedName.slice(0, 13)}...`
      : resolvedName;
  return {resolvedName, displayName};
};

export const HomeScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const {user} = useAuth();
  const dispatch = useDispatch<AppDispatch>();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const companions = useSelector(selectCompanions);
  const selectedCompanionIdRedux = useSelector(selectSelectedCompanionId);

  const {resolvedName: firstName, displayName} = deriveHomeGreetingName(
    user?.firstName,
  );

  // Fetch companions on mount
  React.useEffect(() => {
    if (user?.id) {
      dispatch(fetchCompanions(user.id));
    }
  }, [dispatch, user?.id]);

  const handleAddCompanion = () => {
    navigation.navigate('AddCompanion');
  };

  const handleSelectCompanion = (id: string) => {
    dispatch(setSelectedCompanion(id));
  };

  const getCompanionTaskCount = () => {
    // Mock task count - in a real app, this would come from tasks slice
    return Math.floor(Math.random() * 5);
  };

  const renderCompanionBadge = (companion: any) => {
    const isSelected = selectedCompanionIdRedux === companion.id;

    return (
      <TouchableOpacity
        key={companion.id}
        style={styles.companionTouchable}
        activeOpacity={0.88}
        onPress={() => handleSelectCompanion(companion.id)}>
        <View style={styles.companionItem}>
          <Animated.View
            style={[
              styles.companionAvatarRing,
              isSelected && styles.companionAvatarRingSelected,
              isSelected && {transform: [{scale: 1.08}]},
            ]}>
            {companion.profileImage ? (
              <Image
                source={{uri: companion.profileImage}}
                style={styles.companionAvatar}
              />
            ) : (
              <View style={styles.companionAvatarPlaceholder}>
                <Text style={styles.companionAvatarInitial}>
                  {companion.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </Animated.View>

          <Text style={styles.companionName}>{companion.name}</Text>
          <Text style={styles.companionMeta}>
            {`${getCompanionTaskCount()} Tasks`}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAddCompanionBadge = () => (
    <TouchableOpacity
      key="add-companion"
      style={styles.companionTouchable}
      activeOpacity={0.85}
      onPress={handleAddCompanion}>
      <View style={styles.addCompanionItem}>
        <View style={styles.addCompanionCircle}>
          <Image source={Images.blueAddIcon} style={styles.addCompanionIcon} />
        </View>
        <Text style={styles.addCompanionLabel}>Add companion</Text>
      </View>
    </TouchableOpacity>
  );

  const renderUpcomingTile = (title: string, subtitle: string, key: string) => (
    <LiquidGlassCard
      key={key}
      glassEffect="regular"
      interactive
      style={styles.infoTile}
      fallbackStyle={styles.tileFallback}>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSubtitle}>{subtitle}</Text>
    </LiquidGlassCard>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Account')}
            activeOpacity={0.85}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>
                {firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.greetingName}>Hello, {displayName}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.actionIcon}
              activeOpacity={0.85}
              onPress={() => {
                const tabNavigation =
                  navigation.getParent<NavigationProp<TabParamList>>();
                tabNavigation?.navigate('Appointments');
              }}>
              <Image source={Images.emergencyIcon} style={styles.actionImage} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIcon} activeOpacity={0.85}>
              <Image
                source={Images.notificationIcon}
                style={styles.actionImage}
              />
            </TouchableOpacity>
          </View>
        </View>

        <SearchBar
          placeholder="Search hospitals, groomers, boarders..."
          onPress={() => {}}
        />

        {companions.length === 0 ? (
          <LiquidGlassCard
            glassEffect="regular"
            interactive
            tintColor={theme.colors.primary}
            style={[styles.heroTouchable, styles.heroCard]}
            fallbackStyle={styles.heroFallback}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleAddCompanion}
              style={styles.heroContent}>
              <Image source={Images.paw} style={styles.heroPaw} />
              <Image source={Images.plusIcon} style={styles.heroIconImage} />
              <Text style={styles.heroTitle}>Add your first companion</Text>
            </TouchableOpacity>
          </LiquidGlassCard>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.companionRow}>
            {companions.map(renderCompanionBadge)}
            {renderAddCompanionBadge()}
          </ScrollView>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          {renderUpcomingTile(
            companions.length === 0 ? 'No upcoming tasks' : 'Tasks for today',
            companions.length === 0
              ? 'Add a companion to start managing their tasks'
              : `${companions.length} companion${
                  companions.length > 1 ? 's' : ''
                } have tasks today`,
            'tasks',
          )}
          {renderUpcomingTile(
            companions.length === 0
              ? 'No upcoming appointments'
              : 'Next appointment',
            companions.length === 0
              ? 'Add a companion to start managing their appointments'
              : 'Schedule your next vet visit',
            'appointments',
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expenses</Text>
          <YearlySpendCard amount={0} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <LiquidGlassCard
            glassEffect="regular"
            interactive
            style={styles.quickActionsCard}
            fallbackStyle={styles.tileFallback}>
            <View style={styles.quickActionsRow}>
              {QUICK_ACTIONS.map(action => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.quickAction}
                  activeOpacity={0.88}>
                  <View style={styles.quickActionIconWrapper}>
                    <Image
                      source={action.icon}
                      style={styles.quickActionIcon}
                    />
                  </View>
                  <Text style={styles.quickActionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </LiquidGlassCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing[6],
      paddingTop: theme.spacing[6],
      paddingBottom: theme.spacing[30],
      gap: theme.spacing[6],
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing[3],
    },
    profileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3.5],
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.lightBlueBackground,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    avatarInitials: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
    },
    greetingName: {
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    actionIcon: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionImage: {
      width: 25,
      height: 25,
      resizeMode: 'contain',
    },
    heroTouchable: {
      alignSelf: 'flex-start',
      width: '50%',
      minWidth: 160,
      maxWidth: 160,
    },
    heroCard: {
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing[5],
      minHeight: 160,
      overflow: 'hidden',
      ...theme.shadows.lg,
      shadowColor: theme.colors.neutralShadow,
    },
    heroContent: {
      flex: 1,
      minHeight: 100,
      justifyContent: 'space-between',
      gap: theme.spacing[2],
    },
    heroPaw: {
      position: 'absolute',
      right: -45,
      top: -45,
      width: 160,
      height: 160,
      tintColor: theme.colors.whiteOverlay70,
      resizeMode: 'contain',
    },
    heroIconImage: {
      marginTop: 35,
      marginBottom: theme.spacing[1.25],
      width: 35,
      height: 35,
      tintColor: theme.colors.onPrimary,
      resizeMode: 'contain',
    },
    heroTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.onPrimary,
    },
    heroFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.borderMuted,
      overflow: 'hidden',
    },
    section: {
      gap: theme.spacing[3.5],
    },
    sectionTitle: {
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
    },
    infoTile: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing[5],
      gap: theme.spacing[2],
      ...theme.shadows.md,
      shadowColor: theme.colors.neutralShadow,
      overflow: 'hidden',
    },
    tileFallback: {
      borderRadius: theme.borderRadius.lg,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
    },
    tileTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    tileSubtitle: {
      ...theme.typography.bodySmallTight,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    quickActionsCard: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      paddingVertical: theme.spacing[4.5],
      paddingHorizontal: theme.spacing[4],
      ...theme.shadows.md,
      shadowColor: theme.colors.neutralShadow,
      overflow: 'hidden',
    },
    quickActionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing[3],
    },
    quickAction: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    quickActionIconWrapper: {
      width: 50,
      height: 50,
      borderRadius: 12,
      backgroundColor: theme.colors.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      ...theme.shadows.sm,
      shadowColor: theme.colors.black,
    },
    quickActionIcon: {
      width: 26,
      height: 26,
      resizeMode: 'contain',
      tintColor: theme.colors.white,
    },
    quickActionLabel: {
      ...theme.typography.labelXsBold,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    companionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[4],
      paddingVertical: theme.spacing[2],
    },
    companionTouchable: {
      width: 96,
    },
    companionItem: {
      alignItems: 'center',
      gap: theme.spacing[2.5],
    },
    companionAvatarRing: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 2,
      borderColor: theme.colors.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: theme.colors.cardBackground,
    },
    companionAvatarRingSelected: {
      borderColor: theme.colors.primary,
    },
    companionAvatar: {
      width: '90%',
      height: '90%',
      borderRadius: theme.borderRadius.full,
      resizeMode: 'cover',
    },
    companionAvatarPlaceholder: {
      width: '90%',
      height: '90%',
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.lightBlueBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    companionAvatarInitial: {
      ...theme.typography.titleMedium,
      color: theme.colors.primary,
      fontWeight: '700',
    },
    companionName: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
    },
    companionMeta: {
      ...theme.typography.labelXsBold,
      color: theme.colors.primary,
    },
    addCompanionItem: {
      alignItems: 'center',
      gap: theme.spacing[2.5],
    },
    addCompanionCircle: {
      width: 64,
      height: 64,
      marginBottom: theme.spacing[2.5],
      borderRadius: 32,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: theme.colors.primaryTintStrong,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primarySurface,
    },
    addCompanionIcon: {
      width: 28,
      height: 28,
      resizeMode: 'contain',
    },
    addCompanionLabel: {
      ...theme.typography.labelXsBold,
      color: theme.colors.primary,
      textAlign: 'center',
    },
  });
