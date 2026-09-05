import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '@/hooks';
import {fonts} from '@/theme/typography';

/**
 * Standing notice that the index is modelled from weather, not observed from
 * cases, and is not veterinary advice.
 *
 * This is not decoration. The index is an estimate of conditions, and a pet
 * owner making a health decision needs to know that before they act on it.
 */
export const RiskDisclaimerNotice: React.FC = () => {
  const {theme} = useTheme();
  const {t} = useTranslation();

  return (
    <View
      style={[styles.notice, {backgroundColor: theme.colors.band}]}
      accessible
      accessibilityRole="summary">
      <Ionicons
        name="information-circle-outline"
        size={17}
        color={theme.colors.inkMuted}
        accessibilityElementsHidden
      />
      <Text style={[styles.text, {color: theme.colors.inkMuted}]}>
        {t('parasiteRisk.disclaimer')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    padding: 12,
  },
  text: {
    flex: 1,
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: 12,
    lineHeight: 17,
  },
});
