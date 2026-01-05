import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks';

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
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      {items.map((item) => {
        if (item.hidden) return null;
        return (
          <View key={item.label} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{item.label}</Text>
            <Text style={[styles.detailValue, item.bold && styles.detailValueBold]}>
              {item.value}
            </Text>
          </View>
        );
      })}

      {badges?.map((badge) => (
        <View
          key={badge.text}
          style={[
            styles.statusBadge,
            {backgroundColor: badge.backgroundColor},
          ]}>
          <Text style={[styles.statusText, {color: badge.textColor}]}>
            {badge.text}
          </Text>
        </View>
      ))}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['4'],
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing['2'],
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
