import {Dimensions, StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../../utils/design.utils';
import {colors} from '../../../../../assets/colors';
import {fonts} from '../../../../utils/fonts';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.themeColor,
  },
  petImg: {
    width: Dimensions.get('screen').width,
    height: scaledValue(244),
    borderBottomLeftRadius: scaledValue(32),
    borderBottomRightRadius: scaledValue(32),
  },
  titleText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: '#302F2E',
    width: scaledValue(282),
  },
  secondTitleText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.jetBlack,
  },
  foodBrandDesc: {
    fontSize: scaledValue(16),
    letterSpacing: scaledValue(24 * -0.02),
    color: colors.jetBlack,
    marginTop: scaledValue(20),
    marginBottom: scaledValue(20),
  },

  shareImg: {
    width: scaledValue(23.33),
    height: scaledValue(23.33),
  },
  shareText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    color: colors.appRed,
    marginTop: scaledValue(3),
  },
  tagView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledValue(4),
    marginTop: scaledValue(10),
    paddingHorizontal: scaledValue(20),
  },
  tagText: {
    fontSize: scaledValue(12),
    lineHeight: scaledHeightValue(14.4),
    color: colors.jetLightBlack,
    letterSpacing: scaledValue(10 * -0.02),
  },
  pointer: {
    width: scaledValue(4),
    height: scaledValue(4),
    backgroundColor: colors.appRed,
    borderRadius: scaledValue(4),
  },

  subTitleText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(22.4),
    color: '#302F2E',
    marginTop: scaledValue(20),
    letterSpacing: scaledValue(16 * -0.02),
  },
  button: insets => ({
    backgroundColor: '#FDBD74',
    height: scaledValue(48),
    borderRadius: scaledValue(28),
    bottom: insets?.bottom + scaledValue(50),
    width: '70%',
    alignSelf: 'center',
    position: 'absolute',
  }),
  buttonIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
    marginRight: scaledValue(3),
  },
  buttonText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    color: colors.darkPurple,
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    marginLeft: scaledValue(3),
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: scaledValue(20),
    marginTop: scaledValue(14),
  },
  shareImgView: {
    width: scaledValue(40),
    height: scaledValue(40),
    backgroundColor: '#D041221A',
    borderRadius: scaledValue(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleView: {
    paddingHorizontal: scaledValue(20),
    marginTop: scaledValue(16),
    marginBottom: scaledValue(40),
  },

  listItem: {
    flexDirection: 'row',
    marginBottom: scaledValue(20),
  },
  bullet: {
    fontSize: scaledValue(20),
    marginRight: scaledValue(5),
  },
  listText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(22.4),
    flexShrink: 1,
    letterSpacing: scaledValue(16 * -0.02),
    fontFamily: fonts.SATOSHI_REGULAR,
  },
  boldText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(22.4),
    letterSpacing: scaledValue(16 * -0.02),
    color: '#302F2E',
  },
  establishRelationshipArticleView: {
    paddingHorizontal: scaledValue(21),
    marginBottom: scaledValue(20),
  },
  articleView: {
    paddingHorizontal: scaledValue(21),
    marginBottom: scaledValue(40),
  },
  puppyFeedingScheduleView: {
    paddingHorizontal: scaledValue(21),
    marginBottom: scaledValue(88),
  },
  puppyFeedingImage: {
    width: '100%',
    height: scaledValue(314.76),
    marginBottom: scaledValue(20),
  },
  petProductImage: {
    width: '100%',
    height: scaledValue(344),
    marginBottom: scaledValue(20),
  },
  socialIconImage: {
    width: '100%',
    height: scaledValue(95),
    marginTop: scaledValue(20),
    marginBottom: scaledValue(64.24),
  },
});
