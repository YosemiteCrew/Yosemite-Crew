import { Dimensions, StyleSheet } from 'react-native';
import {
  scaledHeightValue,
  scaledValue,
} from '../../../../../utils/design.utils';
import { fonts } from '../../../../../utils/fonts';
import { colors } from '../../../../../../assets/colors';

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
    width: scaledValue(20),
    height: scaledValue(20),
    
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
    alignItems: 'center',
  },
  addressText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    marginLeft: scaledValue(8),
    width: '90%',
  },
  buttonTextStyle: {
    fontSize: scaledValue(16),
    marginLeft: scaledValue(2),
    letterSpacing: scaledValue(14 * -0.01),
  },
  buttonStyle: {
    marginTop: scaledValue(20),
    borderRadius: scaledValue(28),
    height: scaledValue(44),
    gap: scaledValue(6)
  },
  iconStyle: {
    width: scaledValue(14),
    height: scaledValue(14),
    marginRight: scaledValue(2),
    tintColor: colors.white,
  },
  departmentText: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    color: colors.jetBlack,
    marginTop: scaledValue(25),
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
    color: colors.blue,
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

    textTransform: 'capitalize',
  },
  circleImg: {
    width: scaledValue(16),
    height: scaledValue(16),
  },
  serviceText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),

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
  buttonText1: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.white,
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
  },
  buttonStyle1: {
    marginTop: scaledValue(40),
    marginBottom: scaledValue(62),
    position: 'absolute',
    bottom: 0,
    width: Dimensions.get('window').width - 40,
    alignSelf: 'center',
  },
  inputStyle: {
    height: scaledValue(114),
    marginTop: scaledValue(12),
    borderRadius: scaledValue(16),
    borderColor: colors.darkPurple2,
    width: Dimensions.get('screen').width - 40,
    textAlignVertical: 'top',
    borderWidth: scaledValue(0.5),
    padding: scaledValue(15),
  },
});
