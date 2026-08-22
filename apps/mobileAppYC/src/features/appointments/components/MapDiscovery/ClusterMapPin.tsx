import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors} from '@/theme';

interface ClusterMapPinProps {
  count: number;
}

const ClusterMapPin: React.FC<ClusterMapPinProps> = ({count}) => (
  <View collapsable={false} style={styles.outer}>
    <View style={styles.inner}>
      <Text style={styles.label}>{count}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  outer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.blueGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.blue,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    boxShadow: `0px 2px 6px ${colors.blueShadow}`,
  },
  label: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
});

export default ClusterMapPin;
