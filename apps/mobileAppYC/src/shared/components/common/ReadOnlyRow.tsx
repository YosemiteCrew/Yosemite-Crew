import React, {useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks';

export const ReadOnlyRow: React.FC<{
  label: string;
  value?: string;
}> = ({label, value}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const displayValue = value && value.trim().length > 0 ? value : '—';
  return (
    <View style={styles.readOnlyRowContainer}>
      <Text style={styles.rowButtonLabel}>{label}</Text>
      <Text
        style={styles.rowButtonValue}
        numberOfLines={1}
        ellipsizeMode="tail">
        {displayValue}
      </Text>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    readOnlyRowContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['3'],
    },
    rowButtonLabel: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    rowButtonValue: {
      ...theme.typography.bodyMedium,
      color: theme.colors.secondary,
      marginRight: theme.spacing['3'],
      flexShrink: 1,
      flex: 1,
      textAlign: 'right',
    },
  });
