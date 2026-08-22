import React, {useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, type ColorTokens} from '@/theme';

interface ClusterMapPinProps {
  count: number;
  /** Active palette; light by default. See ClinicMapPin for why not useTheme. */
  palette?: ColorTokens;
}

const ClusterMapPin: React.FC<ClusterMapPinProps> = ({
  count,
  palette = colors,
}) => {
  const styles = useMemo(() => createStyles(palette), [palette]);
  return (
    <View collapsable={false} style={styles.outer}>
      <View style={styles.inner}>
        <Text style={styles.label}>{count}</Text>
      </View>
    </View>
  );
};

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    outer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.blueGlow,
      justifyContent: 'center',
      alignItems: 'center',
    },
    inner: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.blue,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: c.white,
      boxShadow: `0px 2px 6px ${c.blueShadow}`,
    },
    label: {
      color: c.white,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 16,
    },
  });

export default ClusterMapPin;
