import {Dimensions, StyleSheet} from 'react-native';
import {
  scaledHeightValue,
  scaledValue,
} from '../../../../../utils/design.utils';
import {fonts} from '../../../../../utils/fonts';
import {colors} from '../../../../../../assets/colors';

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
    width: '80%',
  },
  shareImg: {
    width: scaledValue(23.33),
    height: scaledValue(23.33),
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
    lineHeight: scaledHeightValue(12 * 1.2),
    letterSpacing: scaledValue(12 * -0.02),
  },
  pointer: {
    width: scaledValue(4),
    height: scaledValue(4),
    backgroundColor: colors.primaryBlue,
    borderRadius: scaledValue(4),
  },
  titleText: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    width: '70%',
    opacity: 0.9,
  },
  subTitleText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(21),
    marginTop: scaledValue(8),
  },
  button: insets => ({
    height: scaledValue(48),
    bottom: insets?.bottom + scaledValue(50),
    width: '70%',
    alignSelf: 'center',
    position: 'absolute',
  }),
  buttonIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
    marginRight: scaledValue(3),
    tintColor: colors.white,
  },
  buttonText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),

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
    backgroundColor: colors.paletteBlue,
    borderRadius: scaledValue(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleView: {
    paddingHorizontal: scaledValue(20),
    marginTop: scaledValue(40),
  },
  shareText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(14 * 1.2),
    color: colors.primaryBlue,
    marginTop: scaledValue(4),
    textAlign: 'center',
  },
});
