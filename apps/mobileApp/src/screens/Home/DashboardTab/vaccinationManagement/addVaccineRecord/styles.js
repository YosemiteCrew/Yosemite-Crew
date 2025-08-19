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
    paddingHorizontal: scaledValue(20),
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
  innerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: scaledValue(30),
  },
  row: {
    flexDirection: 'row',
  },
  oscarText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.appRed,
  },
  vaccinationText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
  },
  recordsText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledValue(4),
  },
  catImage: {
    width: scaledValue(39),
    height: scaledValue(39),
    borderRadius: scaledValue(20),
  },
  arrowImage: {
    width: scaledValue(16),
    height: scaledValue(16),
  },
  input: {
    width: '100%',
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    marginTop: scaledValue(-6),
    paddingLeft: scaledValue(10),
  },
  formContainer: {
    marginTop: scaledValue(28),
    gap: scaledValue(16),
  },
  headerContainer: {
    marginTop: scaledValue(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
    color: colors.darkPurple,
  },
  uploadContainer: {
    width: scaledValue(335),
    borderWidth: scaledValue(1),
    borderStyle: 'dashed',
    borderRadius: scaledValue(20),
    borderColor: '#37223C4D',
    marginTop: scaledValue(32),
  },
  uploadImage: {
    width: scaledValue(40),
    height: scaledValue(40),
    alignSelf: 'center',
    marginTop: scaledValue(16),
  },
  uploadText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    textAlign: 'center',
    paddingHorizontal: scaledValue(53),
    marginTop: scaledValue(10),
  },
  documentText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    textAlign: 'center',
    paddingHorizontal: scaledValue(53),
    opacity: 0.7,
    marginTop: scaledValue(10),
    marginBottom: scaledValue(16),
  },

  buttonStyle: {
    marginTop: scaledValue(40),
    marginBottom: scaledValue(62),
    borderRadius: scaledValue(28),
  },
  // datePickerContainer: val => ({
  //   borderWidth: scaledValue(val ? 1 : 0.5),
  //   height: scaledValue(48),
  //   borderRadius: scaledValue(24),
  //   paddingHorizontal: scaledValue(20),
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'space-between',
  //   borderColor: colors.jetBlack,
  // }),

  inputWrapper: {
    position: 'relative',
  },

  inlineLabelWrapper: {
    position: 'absolute',
    top: scaledValue(-8),
    left: scaledValue(20),
    backgroundColor: colors.themeColor,
    zIndex: 1,
    paddingHorizontal: scaledValue(5),
  },

  inlineLabel: {
    fontSize: scaledValue(12),
  },

  datePickerContainer: val => ({
    borderWidth: scaledValue(val ? 1 : 0.5),
    height: scaledValue(48),
    borderRadius: scaledValue(24),
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderColor: colors.jetBlack,
  }),

  dateText: val => ({
    fontSize: scaledValue(16),
    // lineHeight: scaledHeightValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    color: '#312943',
    fontFamily: val ? fonts?.SATOSHI_MEDIUM : fonts?.SATOSHI_REGULAR,
  }),
  dateIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  PlusIconImage: {
    width: scaledValue(24),
    height: scaledValue(24),
  },
  addImgButton: {
    width: scaledValue(100),
    height: scaledValue(100),
    borderWidth: scaledValue(1),
    borderColor: '#37223C4D',
    borderStyle: 'dashed',
    borderRadius: scaledValue(4),
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageStyle: {
    width: scaledValue(100),
    height: scaledValue(100),
    borderRadius: scaledValue(4),
  },
  crossStyle: {
    width: scaledValue(24),
    height: scaledValue(24),
  },
  crossImgView: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
});
