import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {useTranslation} from 'react-i18next';
import {SafeAreaView} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme, useAppSelector} from '@/hooks';
import {fonts, typography} from '@/theme/typography';
import type {HomeStackParamList} from '@/navigation/types';
import {RiskDisclaimerNotice, RiskTierBadge} from '../../components';
import {selectReadingForParasite, selectRiskLocation} from '../../selectors';
import {
  parasiteNameKey,
  parasitePreventionKey,
  parasiteSignsKey,
  parasiteSummaryKey,
  TIER_PRESENTATION,
  TREND_PRESENTATION,
} from '../../utils/riskPresentation';

type Props = NativeStackScreenProps<HomeStackParamList, 'ParasiteDetail'>;

/**
 * What this parasite is, what it does to a pet, and how it is generally
 * prevented.
 *
 * Deliberately contains no product or brand content in any region: it explains
 * the class of prevention and sends the reader to their vet for the specifics.
 */
export const ParasiteDetailScreen: React.FC<Props> = ({navigation, route}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const {parasiteId} = route.params;

  const reading = useAppSelector(selectReadingForParasite(parasiteId));
  const location = useAppSelector(selectRiskLocation);

  const name = t(parasiteNameKey(parasiteId));

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
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, {color: theme.colors.ink}]}>{name}</Text>

        {reading ? (
          <View style={styles.statusRow}>
            <RiskTierBadge
              tier={reading.tier}
              label={t(TIER_PRESENTATION[reading.tier].labelKey)}
            />
            <Text style={[styles.trend, {color: theme.colors.inkMuted}]}>
              {t(TREND_PRESENTATION[reading.trend].labelKey)}
            </Text>
          </View>
        ) : null}

        {location ? (
          <Text style={[styles.location, {color: theme.colors.inkMuted}]}>
            {t('parasiteRisk.detail.near', {label: location.label})}
          </Text>
        ) : null}

        <Section title={t('parasiteRisk.detail.about')}>
          {t(parasiteSummaryKey(parasiteId))}
        </Section>

        <Section title={t('parasiteRisk.detail.signs')}>
          {t(parasiteSignsKey(parasiteId))}
        </Section>

        <Section title={t('parasiteRisk.detail.prevention')}>
          {t(parasitePreventionKey(parasiteId))}
        </Section>

        <RiskDisclaimerNotice />
      </ScrollView>
    </SafeAreaView>
  );
};

const Section: React.FC<{title: string; children: string}> = ({
  title,
  children,
}) => {
  const {theme} = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, {color: theme.colors.ink}]}>
        {title}
      </Text>
      <Text style={[styles.sectionBody, {color: theme.colors.inkMuted}]}>
        {children}
      </Text>
    </View>
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
  headerSpacer: {width: 24},
  content: {paddingHorizontal: 20, paddingBottom: 40, gap: 14},
  title: {
    ...typography.serifTitleSmall,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trend: {
    fontFamily: fonts.SATOSHI_MEDIUM,
    fontSize: 13,
  },
  location: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: 13,
  },
  section: {gap: 6},
  sectionTitle: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 16,
    lineHeight: 21,
  },
  sectionBody: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: 14,
    lineHeight: 21,
  },
});
