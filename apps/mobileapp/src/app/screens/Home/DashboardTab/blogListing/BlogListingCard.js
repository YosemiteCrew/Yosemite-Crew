import {Image, StyleSheet, TouchableOpacity, View} from 'react-native';
import React from 'react';
import {scaledValue} from '../../../../utils/design.utils';
import {Images} from '../../../../utils';
import {colors} from '../../../../../assets/colors';
import GText from '../../../../components/GText/GText';
import {Divider} from 'react-native-paper';

const BlogListingCard = ({onPress}) => {
  return (
    <View style={styles.cardMainContainer}>
      <Image source={Images.horseArticle} style={styles.petImage} />
      <View style={styles.remediesView}>
        <GText SatoshiBold text={'Skin Care'} style={styles.remedieText} />
        <View style={styles.smallHorizontalLine} />
        <GText
          SatoshiBold
          text={'5 mins read'}
          style={styles.remedieTimeText}
        />
      </View>
      <TouchableOpacity onPress={onPress}>
        <GText
          GrMedium
          text={'5 Home Remedies for Your Dog’s Itchy Skin'}
          style={styles.remediesDescText}
        />
      </TouchableOpacity>
      <Divider style={styles.divider} />
      <View style={styles.docDescCardView}>
        <Image source={Images.DoctorImg} style={styles.docImage} />
        <GText SatoshiBold text={'Dr. Jamie Sailor'} style={styles.docName} />
        <GText SatoshiBold text={'2 days ago'} style={styles.dateText} />
      </View>
    </View>
  );
};

export default BlogListingCard;

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
  divider: {
    marginVertical: scaledValue(20),
    marginHorizontal: scaledValue(16),
  },
  docDescCardView: {
    flexDirection: 'row',
    marginHorizontal: scaledValue(16),
    marginBottom: scaledValue(20),
  },
  docImage: {
    width: scaledValue(40),
    height: scaledValue(40),
    borderRadius: scaledValue(50),
    marginRight: scaledValue(12),
  },
  docName: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.jetLightBlack,
    flex: 1,
  },
});
