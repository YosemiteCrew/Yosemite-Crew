import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import {fonts} from '@/theme/typography';
import type {ParasiteRiskReading} from '../../types';
import {
  TIER_PRESENTATION,
  TREND_PRESENTATION,
} from '../../utils/riskPresentation';
import {RiskTierBadge} from '../RiskTierBadge/RiskTierBadge';

interface ParasiteRiskCardProps {
  reading: ParasiteRiskReading;
  /** Localised parasite name. */
  name: string;
  /** Localised one-line description. */
  summary: string;
  /** Localised tier label. */
  tierLabel: string;
  /** Localised trend label. */
  trendLabel: string;
  onPress: () => void;
}

/** One parasite's current modelled reading, tappable through to the detail. */
export const ParasiteRiskCard: React.FC<ParasiteRiskCardProps> = ({
  reading,
  name,
  summary,
  tierLabel,
  trendLabel,
  onPress,
}) => {
  const {theme} = useTheme();
  const presentation = TIER_PRESENTATION[reading.tier];
  const trend = TREND_PRESENTATION[reading.trend];

  return (
    <PressableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${tierLabel}. ${trendLabel}.`}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.cardBackground,
          borderColor: theme.colors.borderMuted,
        },
      ]}>
      <View
        style={[
          styles.rail,
          {backgroundColor: theme.colors[presentation.color]},
        ]}
      />

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text
            style={[styles.name, {color: theme.colors.ink}]}
            numberOfLines={1}>
            {name}
          </Text>
          <RiskTierBadge tier={reading.tier} label={tierLabel} compact />
        </View>

        <Text
          style={[styles.summary, {color: theme.colors.inkMuted}]}
          numberOfLines={2}>
          {summary}
        </Text>

        <View style={styles.footerRow}>
          <Ionicons
            name={trend.icon}
            size={15}
            color={theme.colors.inkMuted}
            accessibilityElementsHidden
          />
          <Text style={[styles.trend, {color: theme.colors.inkMuted}]}>
            {trendLabel}
          </Text>
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={theme.colors.placeholder}
        accessibilityElementsHidden
      />
    </PressableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingRight: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  rail: {
    width: 4,
    alignSelf: 'stretch',
  },
  body: {
    flex: 1,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 10,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  name: {
    flex: 1,
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 16,
    lineHeight: 20,
  },
  summary: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: 13,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trend: {
    fontFamily: fonts.SATOSHI_MEDIUM,
    fontSize: 12,
    lineHeight: 16,
  },
});
