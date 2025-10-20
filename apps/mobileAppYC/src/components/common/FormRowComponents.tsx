import React, {useMemo} from 'react';
import {View, Text, TouchableOpacity, Image, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export const Separator = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <View style={styles.separator} />;
};

export const RowButton: React.FC<{
  label: string;
  value?: string;
  onPress: () => void;
}> = ({label, value, onPress}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <TouchableOpacity
      style={styles.rowButtonTouchable}
      activeOpacity={0.8}
      onPress={onPress}>
      <Text style={styles.rowButtonLabel}>{label}</Text>
      <Text
        style={styles.rowButtonValue}
        numberOfLines={1}
        ellipsizeMode="tail">
        {value || ' '}
      </Text>
      <Image source={Images.rightArrow} style={styles.rowButtonArrow} />
    </TouchableOpacity>
  );
};

export const ReadOnlyRow: React.FC<{
  label: string;
  value?: string;
}> = ({label, value}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.readOnlyRowContainer}>
      <Text style={styles.rowButtonLabel}>{label}</Text>
      <Text
        style={styles.rowButtonValue}
        numberOfLines={1}
        ellipsizeMode="tail">
        {value || ' '}
      </Text>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    rowButtonTouchable: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing[3],
      paddingHorizontal: theme.spacing[3],
    },
    rowButtonLabel: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
      flex: 1,
    },
    rowButtonValue: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      marginRight: theme.spacing[3],
      flexShrink: 1,
      flex: 1,
      textAlign: 'right',
    },
    rowButtonArrow: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
    readOnlyRowContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing[3],
      paddingHorizontal: theme.spacing[3],
    },
    separator: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.borderSeperator,
      marginLeft: 16,
    },
  });
