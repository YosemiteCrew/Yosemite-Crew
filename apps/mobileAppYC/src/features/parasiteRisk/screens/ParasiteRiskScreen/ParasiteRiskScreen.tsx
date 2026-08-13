import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {SafeAreaView} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {NavigationProp} from '@react-navigation/native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme, useAppDispatch, useAppSelector} from '@/hooks';
import {fonts, typography} from '@/theme/typography';
import type {HomeStackParamList, TabParamList} from '@/navigation/types';
import {
  selectCompanions,
  selectSelectedCompanionId,
} from '@/features/companion';
import {
  selectHasHydratedCompanion,
  selectTasksByCompanion,
} from '@/features/tasks/selectors';
import {
  LapsedCoverBanner,
  ParasiteRiskCard,
  RegionSearchSheet,
  RiskDisclaimerNotice,
  ThreatDial,
} from '../../components';
import {
  selectRecentRiskLocations,
  selectRiskError,
  selectRiskLoading,
  selectRiskLocation,
  selectRiskReading,
  selectRiskReadings,
} from '../../selectors';
import {loadRiskForLocation} from '../../thunks';
import {resolvePreventionCover} from '../../utils/preventionCover';
import {
  parasiteNameKey,
  parasiteSummaryKey,
  TIER_PRESENTATION,
  TREND_PRESENTATION,
} from '../../utils/riskPresentation';
import type {RiskLocation} from '../../types';

type Props = NativeStackScreenProps<HomeStackParamList, 'ParasiteRisk'>;

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

  const companions = useAppSelector(selectCompanions);
  const selectedCompanionId = useAppSelector(selectSelectedCompanionId);
  const companionTasks = useAppSelector(
    selectTasksByCompanion(selectedCompanionId),
  );
  const tasksHydrated = useAppSelector(
    selectHasHydratedCompanion(selectedCompanionId),
  );

  const [searchVisible, setSearchVisible] = useState(false);

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

  const handleSelectLocation = useCallback(
    (next: RiskLocation) => {
      dispatch(loadRiskForLocation(next));
    },
    [dispatch],
  );

  const handleRefresh = useCallback(() => {
    if (location) dispatch(loadRiskForLocation(location));
  }, [dispatch, location]);

  // Prevention tasks live in the Tasks tab, which is a sibling of this stack.
  const handleAddPrevention = useCallback(() => {
    navigation
      .getParent<NavigationProp<TabParamList>>()
      ?.navigate('Tasks', {screen: 'AddTask'});
  }, [navigation]);

  const handleBookVisit = useCallback(() => {
    if (!companion) return;

    navigation.navigate('LinkedBusinesses', {
      screen: 'BusinessSearch',
      params: {
        companionId: companion.id,
        companionName: companion.name,
        companionBreed: companion.breed?.breedName,
        companionImage: companion.profileImage ?? undefined,
        category: 'hospital',
      },
    });
  }, [navigation, companion]);

  // Open the search immediately when there is nothing to show yet: the screen
  // is useless without a place, so do not make the user hunt for the control.
  useEffect(() => {
    if (!location && !loading) setSearchVisible(true);
  }, [location, loading]);

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

        {error && !reading ? (
          <Text style={[styles.error, {color: theme.colors.danger}]}>
            {error}
          </Text>
        ) : null}

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

            {companion && cover ? (
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
  sectionTitle: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 17,
    lineHeight: 22,
  },
});
