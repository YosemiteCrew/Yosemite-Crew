import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import React from 'react';
import {scaledValue} from '../../utils/design.utils';

const HeaderButton = ({icon, tintColor, onPress, style}) => {
  return (
    <TouchableOpacity
      activeOpacity={1}
      style={style ? style : styles.headerButton}
      onPress={onPress}>
      <Image source={icon} tintColor={tintColor} style={styles.headerIcon} />
    </TouchableOpacity>
  );
};

export default HeaderButton;

const styles = StyleSheet.create({
  headerIcon: {
    width: scaledValue(28),
    height: scaledValue(28),
  },
  headerButton: {
    marginHorizontal: scaledValue(4),
  },
});
