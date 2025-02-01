import {Image, StyleSheet, View} from 'react-native';
import React from 'react';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import GText from '../../../components/GText/GText';
import {colors} from '../../../../assets/colors';

const RewardPointCard = ({title, subTitle, icon, containerStyle}) => {
  return (
    <View style={[styles.cardContainer, containerStyle]}>
      <Image source={icon} style={styles.iconStyle} />
      <View>
        <GText GrMedium text={title} style={styles.pointsTitleText} />
        <GText
          SatoshiRegular
          text={subTitle}
          style={styles.pointsSubTitleText}
        />
      </View>
    </View>
  );
};

export default RewardPointCard;

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    marginHorizontal: scaledValue(24),
  },
  pointsTitleText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    color: colors.jetBlack,
  },
  pointsSubTitleText: {
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(15.6),
    color: colors.jetLightBlack,
    marginTop: scaledValue(4),
    width: scaledValue(227),
  },
  iconStyle: {
    width: scaledValue(48),
    height: scaledValue(48),
    marginRight: scaledValue(12),
  },
});
