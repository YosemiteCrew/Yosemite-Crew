import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import {fonts} from '@/theme/typography';
import type {PreventionCover} from '../../utils/preventionCover';

interface LapsedCoverBannerProps {
  cover: PreventionCover;
  companionName: string;
  /** Opens the pet's parasite prevention tasks. */
  onAddPrevention: () => void;
  /** Opens booking with a linked clinic. */
  onBookVisit: () => void;
}

/**
 * The reason this feature is worth building.
 *
 * A forecast on its own tells you the neighbourhood is risky. This tells you
 * whether your pet is actually protected while it is, which is the thing that
 * changes what you do next.
 *
 * Renders nothing when cover is current: no nagging when there is nothing to
 * act on.
 */
export const LapsedCoverBanner: React.FC<LapsedCoverBannerProps> = ({
  cover,
  companionName,
  onAddPrevention,
  onBookVisit,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();

  if (cover.status === 'covered') return null;

  const body =
    cover.status === 'lapsed'
      ? t('parasiteRisk.cover.lapsedBody', {
          name: companionName,
          count: cover.daysOverdue,
        })
      : t('parasiteRisk.cover.noneBody', {name: companionName});

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.riskHighSurface,
          borderColor: theme.colors.riskHigh,
        },
      ]}>
      {/* Only the message is grouped: `accessible` collapses everything below
          it into one node, so the actions have to stay outside to remain
          individually focusable. */}
      <View style={styles.message} accessible accessibilityRole="alert">
        <View style={styles.headerRow}>
          <Ionicons
            name="shield-half-outline"
            size={19}
            color={theme.colors.riskHigh}
            accessibilityElementsHidden
          />
          <Text style={[styles.title, {color: theme.colors.ink}]}>
            {t('parasiteRisk.cover.title')}
          </Text>
        </View>

        <Text style={[styles.body, {color: theme.colors.inkMuted}]}>
          {body}
        </Text>
      </View>

      <View style={styles.actions}>
        <PressableOpacity
          onPress={onAddPrevention}
          accessibilityRole="button"
          style={[styles.primary, {backgroundColor: theme.colors.blue}]}>
          <Text style={[styles.primaryLabel, {color: theme.colors.white}]}>
            {t('parasiteRisk.cover.addPrevention')}
          </Text>
        </PressableOpacity>

        <PressableOpacity
          onPress={onBookVisit}
          accessibilityRole="button"
          style={[styles.secondary, {borderColor: theme.colors.borderMuted}]}>
          <Text style={[styles.secondaryLabel, {color: theme.colors.ink}]}>
            {t('parasiteRisk.cover.bookVisit')}
          </Text>
        </PressableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 16,
  },
  message: {
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 15,
    lineHeight: 19,
  },
  body: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  primary: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 14,
  },
  secondary: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 14,
  },
});
