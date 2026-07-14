import React, {useMemo} from 'react';
import {View, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks';

export const Separator = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <View style={styles.separator} />;
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    separator: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      marginHorizontal: theme.spacing['3'],
    },
  });
