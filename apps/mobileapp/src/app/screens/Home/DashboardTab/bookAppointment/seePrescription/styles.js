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
  textStyle: {
    fontSize: scaledValue(13),
    lineHeight: scaledValue(15.6),
    letterSpacing: scaledValue(13 * -0.01),
    color: '#37223C',
    opacity: 0.7,
    marginTop: scaledValue(4),
  },
  inputStyle: {
    // borderWidth: scaledValue(0.5),
    height: scaledValue(114),
    marginTop: scaledValue(12),
    borderRadius: scaledValue(16),
    borderColor: '#312943',
    textAlignVertical: 'top',
    fontSize: scaledValue(16),
    color: colors.darkPurple,
    backgroundColor: 'transparent',
    width: '100%',
  },
  buttonText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.brown,
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
  },
  buttonStyle: {
    backgroundColor: '#FDBD74',
    marginTop: scaledValue(40),
    marginBottom: scaledValue(62),
    height: scaledValue(52),
    borderRadius: scaledValue(28),
  },
  scrollView: {
    paddingHorizontal: scaledValue(20),
    marginTop: scaledValue(22),
  },
  row: {
    flexDirection: 'row',
  },
  fileImage: {
    width: scaledValue(33),
    height: scaledValue(44),
  },
  prescriptionInfo: {
    paddingLeft: scaledValue(12),
  },
  prescriptionText: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.darkPurple,
  },
  prescriptionName: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.appRed,
  },
  prescriptionImage: {
    width: scaledValue(335),
    height: scaledValue(437),
  },
  chatButton: {
    borderWidth: scaledValue(1),
    borderColor: colors.appRed,
    height: scaledValue(52),
    width: '100%',
    borderRadius: scaledValue(28),
    marginTop: scaledValue(24),
  },
  chatButtonText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.appRed,
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
  },
  shareFeedbackText: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.darkPurple,
    marginTop: scaledValue(44),
  },
  feedbackContainer: {
    width: scaledValue(335),
    backgroundColor: '#FEF8F4',
    borderRadius: scaledValue(20),
    alignItems: 'center',
    marginTop: scaledValue(8),
  },
  doctorImage: {
    width: scaledValue(48),
    height: scaledValue(48),
    marginTop: scaledValue(23),
  },
  doctorName: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    color: '#090A0A',
    marginTop: scaledValue(4),
  },
  doctorSpeciality: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    color: colors.darkPurple,
    marginTop: scaledValue(4),
    opacity: 0.7,
  },
  rateDoctorText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    color: colors.appRed,
    marginTop: scaledValue(16),
  },
  ratingContainer: {
    marginTop: scaledValue(12),
    marginBottom: scaledValue(38),
  },
  reviewText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    color: '#37223C',
    marginTop: scaledValue(24),
  },
});
