import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

interface ClusterMapPinProps {
  count: number;
}

const ClusterMapPin: React.FC<ClusterMapPinProps> = ({count}) => (
  <View style={styles.outer}>
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
    backgroundColor: 'rgba(36, 122, 237, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#247AED',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#247AED',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 7,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
});

export default ClusterMapPin;
