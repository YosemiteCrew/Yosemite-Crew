import {Image, StyleSheet, TouchableOpacity} from 'react-native';
import React from 'react';
import {scaledValue} from '../../../../utils/design.utils';
import GText from '../../../../components/GText/GText';
import {colors} from '../../../../../assets/colors';

const ContactOption = ({icon, title, onPress, titleStyle}) => {
  return (
    <TouchableOpacity style={styles.touchableStyle} onPress={onPress}>
      <Image source={icon} style={styles.iconStyle} />
      <GText GrMedium text={title} style={[styles.title, titleStyle]} />
    </TouchableOpacity>
  );
};

export default ContactOption;

const styles = StyleSheet.create({
  touchableStyle: {
    flexDirection: 'row',
  },
  iconStyle: {
    width: scaledValue(20),
    height: scaledValue(20),
    marginRight: scaledValue(4),
  },
  title: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
    color: colors.appRed,
  },
});
