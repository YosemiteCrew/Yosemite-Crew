import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useSelector} from 'react-redux';
import {useTheme} from '@/hooks';
import {fonts} from '@/theme/typography';
import {RiskTierBadge} from '../RiskTierBadge/RiskTierBadge';
import {selectRiskLocation, selectRiskReadings} from '../../selectors';
import {parasiteNameKey, TIER_PRESENTATION} from '../../utils/riskPresentation';

interface ParasiteRiskHomeCardProps {
  onPress: () => void;
}

/**
 * Home screen entry point.
 *
 * Shows the last known headline reading when there is one, so the card carries
 * information rather than just being another button.
 */
export const ParasiteRiskHomeCard: React.FC<ParasiteRiskHomeCardProps> = ({
  onPress,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();

  // react-redux directly, matching HomeScreen which hosts this card.
  const location = useSelector(selectRiskLocation);
  const readings = useSelector(selectRiskReadings);
  const headline = readings[0] ?? null;
  const summary =
    headline && location
      ? t('parasiteRisk.homeSummary', {
          parasite: t(parasiteNameKey(headline.parasiteId)),
          label: location.label,
        })
      : t('parasiteRisk.homePrompt');
  const accessibilityLabel =
    headline && location
      ? t('parasiteRisk.homeAccessibility', {
          summary,
          tier: t(TIER_PRESENTATION[headline.tier].labelKey),
        })
      : `${t('parasiteRisk.title')}. ${summary}`;

  return (
    <PressableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.cardBackground,
          borderColor: theme.colors.borderMuted,
        },
      ]}>
      <View
        style={[styles.icon, {backgroundColor: theme.colors.riskHighSurface}]}>
        <Ionicons name="bug-outline" size={20} color={theme.colors.riskHigh} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, {color: theme.colors.ink}]}>
          {t('parasiteRisk.title')}
        </Text>
        <Text
          style={[styles.subtitle, {color: theme.colors.inkMuted}]}
          numberOfLines={1}>
          {summary}
        </Text>
      </View>

      {headline ? (
        <RiskTierBadge
          tier={headline.tier}
          label={t(TIER_PRESENTATION[headline.tier].labelKey)}
          compact
        />
      ) : (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={theme.colors.placeholder}
        />
      )}
    </PressableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {flex: 1, gap: 2},
  title: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 15,
    lineHeight: 20,
  },
  subtitle: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: 12,
    lineHeight: 17,
  },
});
