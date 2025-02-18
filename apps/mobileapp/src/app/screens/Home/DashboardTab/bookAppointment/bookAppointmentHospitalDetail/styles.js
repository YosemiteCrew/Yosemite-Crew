import {StyleSheet} from 'react-native';
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
  clinicImg: {
    width: scaledValue(335),
    height: scaledValue(207.52),
    alignSelf: 'center',
    marginTop: scaledValue(10),
    borderRadius: scaledValue(12),
  },
  clinicName: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: '#090A0A',
    marginTop: scaledValue(12),
  },
  timeText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    marginTop: scaledValue(2),
    opacity: 0.7,
  },
  innerView: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textView: {
    flexDirection: 'row',
    paddingTop: scaledValue(12),
  },
  locationImg: {
    width: scaledValue(16),
    height: scaledValue(16),
  },
  distanceText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(18),
    color: '#090A0A',
    marginLeft: scaledValue(4),
  },
  addressView: {
    flexDirection: 'row',
    marginTop: scaledValue(12),
  },
  addressText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    color: colors.darkPurple,
    opacity: 0.7,
    marginLeft: scaledValue(8),
    width: '90%',
  },
  buttonTextStyle: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16),
    color: colors.appRed,
    marginLeft: scaledValue(2),
    letterSpacing: scaledValue(14 * -0.01),
    fontFamily: fonts.CLASH_GRO_MEDIUM,
  },
  buttonStyle: {
    borderWidth: scaledValue(1),
    borderColor: colors.appRed,
    marginTop: scaledValue(20),
    borderRadius: scaledValue(28),
    height: scaledValue(44),
  },
  iconStyle: {
    width: scaledValue(14),
    height: scaledValue(14),
    marginRight: scaledValue(2),
  },
  departmentText: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    color: colors.appRed,
    marginTop: scaledValue(40),
    letterSpacing: scaledValue(18 * -0.01),
  },
  questionsContainer: {
    marginTop: scaledValue(26.5),
  },
  questionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  questionText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
    color: colors.appRed,
  },
  rightArrow: {
    width: scaledValue(20),
    height: scaledValue(20),
    marginLeft: scaledValue(4),
  },
  separator: {
    borderWidth: scaledValue(0.5),
    borderColor: 'rgba(55, 34, 60, 0.1)',
    marginVertical: scaledValue(15),
  },
  departmentTextStyle: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
    color: colors.darkPurple,
  },
  circleImg: {
    width: scaledValue(16),
    height: scaledValue(16),
  },
  serviceText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    opacity: 0.8,
    marginLeft: scaledValue(8),
  },
  serviceView: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceContainer: {
    marginTop: scaledValue(16),
    gap: scaledValue(12),
    marginBottom: scaledValue(100),
  },
});
