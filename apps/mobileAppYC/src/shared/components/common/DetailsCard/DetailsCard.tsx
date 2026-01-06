import React from 'react';
import {View, Text, StyleSheet, Platform} from 'react-native';
import {useTheme} from '@/hooks';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';

export type DetailItem = {
  label: string;
  value: string | number;
  hidden?: boolean;
  bold?: boolean;
};

export type DetailBadge = {
  text: string;
  backgroundColor: string;
  textColor: string;
};

type DetailsCardProps = {
  title: string;
  items: DetailItem[];
  badges?: DetailBadge[];
};

export const DetailsCard: React.FC<DetailsCardProps> = ({title, items, badges}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <LiquidGlassCard
      glassEffect="clear"
      padding="4"
      shadow="sm"
      style={styles.card}
      fallbackStyle={styles.cardFallback}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>

        {items.map(item => {
          if (item.hidden) return null;
          return (
            <View key={item.label} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{item.label}</Text>
              <Text style={[styles.detailValue, item.bold && styles.detailValueBold]}>{item.value}</Text>
            </View>
          );
        })}

        {badges?.map(badge => (
          <View
            key={badge.text}
            style={[
              styles.statusBadge,
              {backgroundColor: badge.backgroundColor},
            ]}>
            <Text style={[styles.statusText, {color: badge.textColor}]}>{badge.text}</Text>
          </View>
        ))}
      </View>
    </LiquidGlassCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.lg,
      padding: 0,
      gap: theme.spacing['2'],
    },
    content: {
      padding: theme.spacing['4'],
      gap: theme.spacing['2'],
      backgroundColor: 'transparent',
    },
    cardFallback: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.lg,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: theme.colors.border,
      ...theme.shadows.base,
      shadowColor: theme.colors.neutralShadow,
    },
    title: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
      marginBottom: theme.spacing['1'],
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing['2'],
    },
    detailLabel: {
      ...theme.typography.labelSmall,
      color: theme.colors.textSecondary,
      maxWidth: '45%',
    },
    detailValue: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.secondary,
      flex: 1,
      textAlign: 'right',
      flexWrap: 'wrap',
    },
    detailValueBold: {
      fontWeight: '700',
    },
    statusBadge: {
      paddingVertical: theme.spacing['1'],
      paddingHorizontal: theme.spacing['3'],
      borderRadius: theme.borderRadius.full,
      alignSelf: 'flex-start',
      marginTop: theme.spacing['2'],
    },
    statusText: {
      ...theme.typography.labelSmall,
    },
  });
