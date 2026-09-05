import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks';
import {fonts} from '@/theme/typography';
import type {RiskTier} from '../../types';
import {TIER_PRESENTATION} from '../../utils/riskPresentation';

interface RiskTierBadgeProps {
  tier: RiskTier;
  /** Already-localised tier label. */
  label: string;
  compact?: boolean;
}

/** Pill showing a tier as a written word on its tinted surface. */
export const RiskTierBadge: React.FC<RiskTierBadgeProps> = ({
  tier,
  label,
  compact = false,
}) => {
  const {theme} = useTheme();
  const presentation = TIER_PRESENTATION[tier];

  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        {backgroundColor: theme.colors[presentation.surface]},
      ]}>
      <Text
        style={[
          styles.label,
          compact && styles.labelCompact,
          {color: theme.colors[presentation.color]},
        ]}
        numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 21.5,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  badgeCompact: {
    height: 24,
    paddingHorizontal: 10,
  },
  label: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 13,
    lineHeight: 16,
  },
  labelCompact: {
    fontSize: 12,
    lineHeight: 15,
  },
});
