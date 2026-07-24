import React, {useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';

interface ViewFieldProps {
  label: string;
  value: string;
  first?: boolean;
  multiline?: boolean;
}

interface ViewTouchFieldProps {
  label: string;
  value: string;
  first?: boolean;
}

interface DetailRowProps {
  label: string;
  value: string;
  first?: boolean;
  multiline?: boolean;
}

/**
 * Warm-bone detail row for TaskViewScreen. Hairline-divided label/value line
 * that stacks inside a `screen2` detail group card. The first row of each card
 * passes `first` to drop its top divider.
 */
const DetailRow: React.FC<DetailRowProps> = ({
  label,
  value,
  first,
  multiline,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View
      testID="detail-row"
      style={[
        styles.row,
        !first && styles.rowDivider,
        multiline && styles.rowMultiline,
      ]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, multiline && styles.valueMultiline]}>
        {value}
      </Text>
    </View>
  );
};

/**
 * Read-only detail row for TaskViewScreen.
 */
export const ViewField: React.FC<ViewFieldProps> = ({
  label,
  value,
  first,
  multiline,
}) => (
  <DetailRow label={label} value={value} first={first} multiline={multiline} />
);

/**
 * Read-only detail row for values that were previously surfaced as pickers.
 * In the read view they render identically to {@link ViewField}.
 */
export const ViewTouchField: React.FC<ViewTouchFieldProps> = ({
  label,
  value,
  first,
}) => <DetailRow label={label} value={value} first={first} />;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing['3.5'],
      gap: theme.spacing['4'],
    },
    rowMultiline: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: theme.spacing['1'],
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.hairline,
    },
    label: {
      ...theme.typography.bodySmall,
      color: theme.colors.inkFaint,
    },
    value: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.inkBody,
      flex: 1,
      textAlign: 'right',
    },
    valueMultiline: {
      ...theme.typography.bodySmall,
      color: theme.colors.inkBody,
      flex: 0,
      alignSelf: 'stretch',
      textAlign: 'left',
    },
  });
