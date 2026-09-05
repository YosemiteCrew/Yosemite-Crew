import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ToastAndroid,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {SafeAreaView} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {NavigationProp} from '@react-navigation/native';
import {isTierAtLeast} from '@yosemite-crew/types';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme, useAppDispatch, useAppSelector} from '@/hooks';
import {fonts, typography} from '@/theme/typography';
import type {HomeStackParamList, TabParamList} from '@/navigation/types';
import {
  selectCompanions,
  selectSelectedCompanionId,
} from '@/features/companion';
import type {
  CoParentPermissions,
  ParentCompanionAccess,
} from '@/features/coParent/types';
import {
  selectHasHydratedCompanion,
  selectTasksByCompanion,
} from '@/features/tasks/selectors';
import {LapsedCoverBanner} from '../../components/LapsedCoverBanner/LapsedCoverBanner';
import {ParasiteRiskCard} from '../../components/ParasiteRiskCard/ParasiteRiskCard';
import {RegionSearchSheet} from '../../components/RegionSearchSheet/RegionSearchSheet';
import {RiskDisclaimerNotice} from '../../components/RiskDisclaimerNotice/RiskDisclaimerNotice';
import {ThreatDial} from '../../components/ThreatDial/ThreatDial';
import {
  selectRecentRiskLocations,
  selectCurrentLocationSubscription,
  selectRiskError,
  selectRiskLoading,
  selectRiskLocation,
  selectRiskReading,
  selectRiskReadings,
  selectSubscriptionsLoading,
} from '../../selectors';
import {
  followLocation,
  loadRiskForLocation,
  loadSubscriptions,
  unfollowLocation,
} from '../../thunks';
import {resolvePreventionCover} from '../../utils/preventionCover';
import {
  parasiteNameKey,
  parasiteSummaryKey,
  TIER_PRESENTATION,
  TREND_PRESENTATION,
} from '../../utils/riskPresentation';
import type {ParasiteRiskCellReading, RiskLocation} from '../../types';

type Props = NativeStackScreenProps<HomeStackParamList, 'ParasiteRisk'>;

/**
 * The tier from which the cover warning is worth raising.
 *
 * Its copy states that local risk is high right now, so it must not be shown
 * against a low or moderate forecast just because a prevention task is missing.
 */
const COVER_WARNING_TIER = 'HIGH' as const;

/**
 * How old a stored reading may be before it is refetched on open.
 *
 * The API recomputes a cell once a day (`computedAt` carries the last run), and
 * this slice is persisted, so a rehydrated forecast can be days old. One
 * refresh cycle is the same window the API itself treats a cell as current for.
 */
const READING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const isReadingStale = (
  reading: ParasiteRiskCellReading | null,
  now: number,
): boolean => {
  if (!reading) return true;
  const computedAt = Date.parse(reading.computedAt);
  return Number.isNaN(computedAt) || now - computedAt >= READING_MAX_AGE_MS;
};

const FollowLocationButton = ({
  visible,
  following,
  loading,
  onPress,
}: {
  visible: boolean;
  following: boolean;
  loading: boolean;
  onPress: () => void;
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  if (!visible) return null;
  const labelKey = following ? 'parasiteRisk.unfollow' : 'parasiteRisk.follow';
  const iconName = following
    ? 'notifications-off-outline'
    : 'notifications-outline';

  return (
    <PressableOpacity
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={t(labelKey)}
      style={[
        styles.followButton,
        {borderColor: theme.colors.blue},
        loading && styles.followDisabled,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.blue} />
      ) : (
        <Ionicons name={iconName} size={18} color={theme.colors.blue} />
      )}
      <Text style={[styles.followLabel, {color: theme.colors.blueText}]}>
        {t(labelKey)}
      </Text>
    </PressableOpacity>
  );
};

export const ParasiteRiskScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const dispatch = useAppDispatch();

  const location = useAppSelector(selectRiskLocation);
  const reading = useAppSelector(selectRiskReading);
  const readings = useAppSelector(selectRiskReadings);
  const loading = useAppSelector(selectRiskLoading);
  const error = useAppSelector(selectRiskError);
  const recentLocations = useAppSelector(selectRecentRiskLocations);
  const currentSubscription = useAppSelector(selectCurrentLocationSubscription);
  const subscriptionsLoading = useAppSelector(selectSubscriptionsLoading);

  const companions = useAppSelector(selectCompanions);
  const selectedCompanionId = useAppSelector(selectSelectedCompanionId);
  const companionTasks = useAppSelector(
    selectTasksByCompanion(selectedCompanionId),
  );
  const tasksHydrated = useAppSelector(
    selectHasHydratedCompanion(selectedCompanionId),
  );

  const accessEntry = useAppSelector(state =>
    selectedCompanionId
      ? (state.coParent?.accessByCompanionId?.[selectedCompanionId] ?? null)
      : null,
  );
  const defaultAccess = useAppSelector(
    state => state.coParent?.defaultAccess ?? null,
  );
  const globalRole = useAppSelector(
    state => state.coParent?.lastFetchedRole ?? null,
  );
  const globalPermissions = useAppSelector(
    state => state.coParent?.lastFetchedPermissions ?? null,
  );

  const [searchVisible, setSearchVisible] = useState(
    () => !location && !loading && !error,
  );

  const companion = useMemo(
    () => companions.find(entry => entry.id === selectedCompanionId) ?? null,
    [companions, selectedCompanionId],
  );

  // Tasks are fetched by the Home screen, so this screen can open while that
  // request is still in flight. Until it lands, an empty task list means "not
  // loaded yet" rather than "no cover", so hold the verdict back instead of
  // telling someone their pet is unprotected when it may well be.
  const cover = useMemo(
    () => (tasksHydrated ? resolvePreventionCover(companionTasks) : null),
    [companionTasks, tasksHydrated],
  );

  const headline = readings[0] ?? null;

  // Both banner actions leave this screen for a feature a co-parent may not
  // hold, so they are guarded the same way the Home handlers are: the entry for
  // the selected companion, then the account default, then whatever role and
  // permissions were last fetched.
  const canAccessFeature = useCallback(
    (permission: keyof CoParentPermissions) => {
      const entry: ParentCompanionAccess | null = accessEntry ?? defaultAccess;
      const role = (entry?.role ?? globalRole ?? '').toUpperCase();
      if (role.includes('PRIMARY')) return true;
      const permissions = entry?.permissions ?? globalPermissions;
      return Boolean(permissions?.[permission]);
    },
    [accessEntry, defaultAccess, globalPermissions, globalRole],
  );

  const guardFeature = useCallback(
    (permission: keyof CoParentPermissions, label: string) => {
      if (canAccessFeature(permission)) return true;

      const message = t('parasiteRisk.permission.message', {
        feature: t(`parasiteRisk.permission.${label}`),
      });
      if (Platform.OS === 'android') {
        ToastAndroid.show(message, ToastAndroid.SHORT);
      } else {
        Alert.alert(t('parasiteRisk.permission.title'), message);
      }
      return false;
    },
    [canAccessFeature, t],
  );

  const handleSelectLocation = useCallback(
    (next: RiskLocation) => {
      dispatch(loadRiskForLocation(next));
    },
    [dispatch],
  );

  const handleRefresh = useCallback(() => {
    if (location) dispatch(loadRiskForLocation(location));
  }, [dispatch, location]);

  const handleToggleFollow = useCallback(() => {
    if (!location) return;
    if (currentSubscription) {
      dispatch(unfollowLocation(currentSubscription.id));
    } else {
      dispatch(followLocation({location}));
    }
  }, [currentSubscription, dispatch, location]);

  // Prevention tasks live in the Tasks tab, which is a sibling of this stack.
  const handleAddPrevention = useCallback(() => {
    if (!guardFeature('tasks', 'tasks')) return;

    navigation
      .getParent<NavigationProp<TabParamList>>()
      ?.navigate('Tasks', {screen: 'AddTask'});
  }, [guardFeature, navigation]);

  // Booking runs through the Appointments tab, the same destination the Home
  // screen sends its booking CTA to. The LinkedBusinesses stack only attaches a
  // clinic to a companion; nothing in it can book a visit.
  const handleBookVisit = useCallback(() => {
    if (!guardFeature('appointments', 'appointments')) return;

    navigation
      .getParent<NavigationProp<TabParamList>>()
      ?.navigate('Appointments', {screen: 'BrowseBusinesses'});
  }, [guardFeature, navigation]);

  useEffect(() => {
    dispatch(loadSubscriptions());
  }, [dispatch]);

  // A persisted location rehydrates with whatever reading was stored alongside
  // it, which may be days old. Revalidate once when the screen opens so an
  // expired forecast is not presented as the current one; pull-to-refresh stays
  // the manual path.
  const revalidatedOnOpen = useRef(false);
  useEffect(() => {
    if (revalidatedOnOpen.current || !location || loading) return;
    revalidatedOnOpen.current = true;
    if (isReadingStale(reading, Date.now())) {
      dispatch(loadRiskForLocation(location));
    }
  }, [dispatch, loading, location, reading]);

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: theme.colors.page}]}
      edges={['top']}>
      <View style={styles.header}>
        <PressableOpacity
          onPress={navigation.goBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.ink} />
        </PressableOpacity>
        <Text style={[styles.title, {color: theme.colors.ink}]}>
          {t('parasiteRisk.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
        }>
        <PressableOpacity
          onPress={() => setSearchVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t('parasiteRisk.search.title')}
          style={[
            styles.locationPill,
            {
              backgroundColor: theme.colors.cardBackground,
              borderColor: theme.colors.borderMuted,
            },
          ]}>
          <Ionicons name="location" size={17} color={theme.colors.blue} />
          <Text
            style={[styles.locationLabel, {color: theme.colors.ink}]}
            numberOfLines={1}>
            {location?.label ?? t('parasiteRisk.search.prompt')}
          </Text>
          <Ionicons
            name="chevron-down"
            size={17}
            color={theme.colors.placeholder}
          />
        </PressableOpacity>

        {loading && !reading ? (
          <ActivityIndicator style={styles.loader} size="large" />
        ) : null}

        {error ? (
          <Text style={[styles.error, {color: theme.colors.danger}]}>
            {t(error)}
          </Text>
        ) : null}

        <FollowLocationButton
          visible={Boolean(location && reading)}
          following={Boolean(currentSubscription)}
          loading={subscriptionsLoading}
          onPress={handleToggleFollow}
        />

        {reading && headline ? (
          <>
            <ThreatDial
              tier={headline.tier}
              index={headline.index}
              tierLabel={t(TIER_PRESENTATION[headline.tier].labelKey)}
              caption={t('parasiteRisk.headline', {
                parasite: t(parasiteNameKey(headline.parasiteId)),
              })}
            />

            {reading.degraded ? (
              <Text style={[styles.degraded, {color: theme.colors.inkMuted}]}>
                {t('parasiteRisk.degraded')}
              </Text>
            ) : null}

            {companion &&
            cover &&
            isTierAtLeast(headline.tier, COVER_WARNING_TIER) ? (
              <LapsedCoverBanner
                cover={cover}
                companionName={companion.name}
                onAddPrevention={handleAddPrevention}
                onBookVisit={handleBookVisit}
              />
            ) : null}

            <Text style={[styles.sectionTitle, {color: theme.colors.ink}]}>
              {t('parasiteRisk.sectionTitle')}
            </Text>

            {readings.map(entry => (
              <ParasiteRiskCard
                key={entry.parasiteId}
                reading={entry}
                name={t(parasiteNameKey(entry.parasiteId))}
                summary={t(parasiteSummaryKey(entry.parasiteId))}
                tierLabel={t(TIER_PRESENTATION[entry.tier].labelKey)}
                trendLabel={t(TREND_PRESENTATION[entry.trend].labelKey)}
                onPress={() =>
                  navigation.navigate('ParasiteDetail', {
                    parasiteId: entry.parasiteId,
                  })
                }
              />
            ))}

            <RiskDisclaimerNotice />
          </>
        ) : null}
      </ScrollView>

      <RegionSearchSheet
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelect={handleSelectLocation}
        recentLocations={recentLocations}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: {
    ...typography.serifTitleSmall,
    fontSize: 22,
    lineHeight: 28,
  },
  headerSpacer: {width: 24},
  content: {paddingHorizontal: 20, paddingBottom: 40, gap: 16},
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  locationLabel: {
    flex: 1,
    fontFamily: fonts.SATOSHI_MEDIUM,
    fontSize: 15,
  },
  loader: {marginTop: 40},
  error: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
  degraded: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  followButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  followLabel: {
    fontFamily: fonts.SATOSHI_MEDIUM,
    fontSize: 15,
  },
  followDisabled: {opacity: 0.5},
  sectionTitle: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 17,
    lineHeight: 22,
  },
});
