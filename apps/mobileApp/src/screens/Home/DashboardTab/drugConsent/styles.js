import {StyleSheet} from 'react-native';
import {colors} from '../../../../../assets/colors';
import {scaledValue} from '../../../../utils/design.utils';
import {fonts} from '../../../../utils/fonts';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.themeColor,
  },
  nextButton: {
    marginHorizontal: scaledValue(20),
    // marginTop: scaledValue(20),
    marginBottom: scaledValue(30),
    marginTop: scaledValue(30),
  },
  stepHeader: {
    color: colors.jetLightBlack,
    marginTop: scaledValue(8),
    marginBottom: scaledValue(20),
    textAlign: 'center',
    fontSize: scaledValue(12),
  },
  women_working: {
    height: scaledValue(192),
    width: scaledValue(293),
    resizeMode: 'contain',
    alignSelf: 'center',
  },
  titleText: {
    textAlign: 'center',
    marginTop: scaledValue(20),
    color: colors.jetBlack,
    fontSize: scaledValue(23),
    lineHeight: scaledValue(23 * 1.2),
    letterSpacing: scaledValue(23 * -0.01),
    marginHorizontal: scaledValue(49),
  },
  sunHeaderText: {
    fontSize: scaledValue(15),
    marginHorizontal: scaledValue(20),
    color: colors.jetLightBlack,
    textAlign: 'center',
  },
  desText: {
    fontSize: scaledValue(16),
    marginHorizontal: scaledValue(20),
    lineHeight: scaledValue(16 * 1.2),
    color: colors.jetBlack,
    marginTop: scaledValue(28),
    marginBottom: scaledValue(16),
  },
  linkText: {
    fontSize: scaledValue(16),
    marginLeft: scaledValue(20),
    lineHeight: scaledValue(16 * 1.2),
    color: colors.jetBlack,
  },
  ques: {
    fontSize: scaledValue(16),
    marginLeft: scaledValue(20),
    lineHeight: scaledValue(16 * 1.2),
    marginTop: scaledValue(16),
    color: colors.jetBlack,
  },
  circleButton: {
    height: scaledValue(20),
    width: scaledValue(20),
  },
  optionsView: {
    marginHorizontal: scaledValue(20),
    gap: scaledValue(8),
    marginBottom: scaledValue(16),
    marginTop: scaledValue(16),
    flexDirection: 'row',
  },
  parentText: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: scaledValue(15),
    lineHeight: scaledValue(15 * 1.2),
    color: colors.jetLightBlack,
  },
  instructionView: {
    flexDirection: 'row',
    marginHorizontal: scaledValue(20),

    marginBottom: scaledValue(16),
    gap: scaledValue(8),
    alignItems: 'center',
  },
  instTitle: {
    marginBottom: scaledValue(16),
    fontSize: scaledValue(15),
    lineHeight: scaledValue(15 * 1.2),
    fontFamily: fonts.SATOSHI_BOLD,
    color: colors.jetLightBlack,
    marginLeft: scaledValue(20),
    letterSpacing: scaledValue(15 * -0.02),
  },
  terms: {
    color: colors.blue,
  },
  instText: {
    fontSize: scaledValue(15),
    fontFamily: fonts.SATOSHI_BOLD,
    lineHeight: scaledValue(15 * 1.2),
    marginRight: scaledValue(20),
    color: colors.jetBlack,
  },
});
