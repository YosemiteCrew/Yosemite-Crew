import {Platform, StyleSheet} from 'react-native';
import {
  scaledHeightValue,
  scaledValue,
} from '../../../../../utils/design.utils';
import {fonts} from '../../../../../utils/fonts';
import {colors} from '../../../../../../assets/colors';

export const styles = StyleSheet.create({
  dashboardMainView: {
    flex: 1,
    backgroundColor: colors.themeColor,
  },
  scrollView: {
    flex: 1,
  },
  headerRight: {
    paddingRight: scaledValue(20),
  },
  headerLeft: {
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: scaledValue(28),
    height: scaledValue(28),
  },
  headerButton: {
    marginHorizontal: scaledValue(20),
  },
  questionsText: {
    fontSize: scaledValue(12),
    lineHeight: scaledValue(12),
    textAlign: 'center',
    color: colors.appRed,
  },
  eclipse: {
    width: scaledValue(335),
    height: scaledValue(198),
    marginTop: scaledValue(43),
    alignItems: 'center',
  },
  containerView: {
    backgroundColor: '#FADA4A',
    width: scaledValue(335),
    alignSelf: 'center',
    marginTop: scaledValue(40),
    borderRadius: scaledValue(20),
  },
  petImg: {
    width: scaledValue(60),
    height: scaledValue(60),
    bottom: scaledValue(15),
  },
  scoreText: {
    fontSize: scaledValue(20),
    lineHeight: scaledValue(24),
    textAlign: 'center',
    color: colors.darkPurple,
    letterSpacing: scaledValue(20 * -0.01),
  },
  numberText: {
    fontSize: scaledValue(41),
    lineHeight: scaledValue(49.2),
    textAlign: 'center',
    color: colors.darkPurple,
    letterSpacing: scaledValue(41 * -0.01),
    marginTop: scaledValue(12),
  },
  moderateText: {
    fontSize: scaledValue(23),
    lineHeight: scaledValue(27.6),
    textAlign: 'center',
    color: '#312943',
    letterSpacing: scaledValue(23 * -0.01),
  },
  description: {
    fontSize: scaledValue(16),
    ineHeight: scaledValue(22.4),
    textAlign: 'center',
    color: colors.darkPurple,
    letterSpacing: scaledValue(16 * -0.02),
    marginTop: scaledValue(20),
    paddingHorizontal: scaledValue(25),
  },
  createButton: {
    backgroundColor: '#FDBD74',
    width: scaledValue(335),
    height: scaledValue(52),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: scaledValue(68),
  },
  buttonText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(16 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    color: colors.brown,
  },
  skipButton: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.appRed,
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    textAlign: 'center',
    marginTop: scaledValue(17),
  },
  buttonView: insets => ({
    position: 'absolute',
    bottom:
      Platform.OS == 'android'
        ? insets.bottom + scaledValue(47)
        : insets.bottom + scaledValue(15),
    alignSelf: 'center',
  }),
});
