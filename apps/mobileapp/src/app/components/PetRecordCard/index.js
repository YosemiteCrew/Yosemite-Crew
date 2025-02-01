import {Image, StyleSheet, TouchableOpacity, View} from 'react-native';
import React from 'react';
import GText from '../GText/GText';
import {scaledValue} from '../../utils/design.utils';
import {colors} from '../../../assets/colors';

const PetRecordCard = ({
  image,
  title,
  subTitle,
  labelName,
  labelColor,
  labelStyle,
  labelTextStyle,
  labelTextColor,
  titleTextStyle,
  rightIcon,
  containerStyle,
  onPress,
  rightArrow,
}) => {
  return (
    <View style={[styles.cardContainer, containerStyle]}>
      {image && <Image source={image} style={styles.image} />}
      <View style={{flex: 1}}>
        <GText
          GrMedium
          text={title}
          style={[styles.titleText, titleTextStyle]}
        />
        {subTitle && (
          <GText SatoshiBold text={subTitle} style={styles.subTitleText} />
        )}
      </View>
      <TouchableOpacity onPress={onPress} style={styles.labelTouchable}>
        <View style={[styles.labelView(labelColor), labelStyle]}>
          <GText
            SatoshiBold
            text={labelName}
            style={[styles.labelText(labelTextColor), labelTextStyle]}
          />
        </View>
        {!rightIcon && labelName !== 'Select' && rightArrow && rightArrow}
      </TouchableOpacity>
      {rightIcon && rightIcon}
    </View>
  );
};

export default PetRecordCard;

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaledValue(16),
  },
  image: {
    width: scaledValue(40),
    height: scaledValue(40),
    marginRight: scaledValue(8),
  },
  labelView: labelColor => ({
    backgroundColor: labelColor,
    paddingVertical: scaledValue(4),
    paddingHorizontal: scaledValue(11),
    borderRadius: scaledValue(28),
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  }),
  labelTouchable: {flexDirection: 'row', alignItems: 'center'},
  titleText: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.darkPurple,
  },
  subTitleText: {
    fontSize: scaledValue(13),
    lineHeight: scaledValue(15.6),
    color: colors.darkPurple,
    opacity: 0.6,
  },
  labelText: labelTextColor => ({
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    color: labelTextColor ? labelTextColor : colors.white,
  }),
});
