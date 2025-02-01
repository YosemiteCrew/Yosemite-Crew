import {Image, StyleSheet, TouchableOpacity, View} from 'react-native';
import React from 'react';
import {scaledValue} from '../../../../utils/design.utils';
import {Images} from '../../../../utils';
import {colors} from '../../../../../assets/colors';
import GText from '../../../../components/GText/GText';

const ArticleCard = ({onPress, cardContainerStyle}) => {
  return (
    <View style={[styles.cardMainContainer, cardContainerStyle]}>
      <Image source={Images.horseArticle} style={styles.petImage} />
      <View style={styles.remediesView}>
        <GText SatoshiBold text={'Training'} style={styles.remedieText} />
        <View style={styles.smallHorizontalLine} />
        <GText
          SatoshiBold
          text={'4 mins read'}
          style={styles.remedieTimeText}
        />
      </View>
      <TouchableOpacity
        onPress={onPress}
        style={{marginBottom: scaledValue(20)}}>
        <GText
          GrMedium
          text={'How To Stop a Puppy From Biting'}
          style={styles.remediesDescText}
        />
      </TouchableOpacity>
    </View>
  );
};

export default ArticleCard;

const styles = StyleSheet.create({
  cardMainContainer: {
    backgroundColor: colors.pearlWhite,
    borderTopLeftRadius: scaledValue(18),
    borderTopRightRadius: scaledValue(18),
    borderBottomLeftRadius: scaledValue(12),
    borderBottomRightRadius: scaledValue(12),
    shadowColor: '#47382726',
    shadowOffset: {width: 0, height: scaledValue(1)},
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 8,
  },
  petImage: {
    width: scaledValue(334),
    height: scaledValue(225),
    borderRadius: scaledValue(20),
    marginBottom: scaledValue(20),
  },
  remediesView: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaledValue(12),
    marginHorizontal: scaledValue(16),
  },
  remedieText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    color: colors.appRed,
  },
  smallHorizontalLine: {
    width: scaledValue(16),
    height: scaledValue(1),
    backgroundColor: colors.jetBlack200,
    marginHorizontal: scaledValue(12),
  },
  remedieTimeText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.jetBlack200,
  },
  remediesDescText: {
    fontSize: scaledValue(20),
    lineHeight: scaledValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.jetBlack,
    marginHorizontal: scaledValue(16),
  },
});
