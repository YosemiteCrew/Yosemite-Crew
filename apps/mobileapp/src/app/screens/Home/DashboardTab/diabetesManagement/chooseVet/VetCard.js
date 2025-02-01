import {Image, StyleSheet, TouchableOpacity, View} from 'react-native';
import React from 'react';
import GText from '../../../../../components/GText/GText';
import {colors} from '../../../../../../assets/colors';
import {scaledValue} from '../../../../../utils/design.utils';

const VetCard = ({
  image,
  name,
  professions,
  qualification,
  onPress,
  rightIcon,
  vetContainerStyle,
  nameTextColor,
  textColor,
}) => {
  return (
    <TouchableOpacity
      style={[styles.vetDetailMainView, vetContainerStyle]}
      onPress={onPress}
      activeOpacity={0.6}>
      <Image source={image} style={styles.vetImage} />
      <View style={{flex: 1}}>
        <GText GrMedium text={name} style={styles.vetName(nameTextColor)} />
        <GText
          SatoshiBold
          text={professions}
          style={styles.vetDetailText(textColor)}
        />
        <GText
          SatoshiBold
          text={qualification}
          style={styles.vetDetailText(textColor)}
        />
      </View>

      {rightIcon && rightIcon}
    </TouchableOpacity>
  );
};

export default VetCard;

const styles = StyleSheet.create({
  vetDetailMainView: {
    backgroundColor: colors.pearlWhite,
    flexDirection: 'row',
    paddingHorizontal: scaledValue(12),
    paddingVertical: scaledValue(12),
    borderRadius: scaledValue(20),
    shadowColor: '#47382726',
    shadowOffset: {width: 1, height: scaledValue(2)},
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 8,
  },
  vetImage: {
    width: scaledValue(88),
    height: scaledValue(88),
    marginRight: scaledValue(8),
  },
  vetName: nameTextColor => ({
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    color: nameTextColor,
  }),
  vetDetailText: textColor => ({
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    opacity: 0.7,
    color: textColor,
  }),
});
