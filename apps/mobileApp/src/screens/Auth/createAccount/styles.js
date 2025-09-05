import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {fonts} from '../../../utils/fonts';
import {colors} from '../../../../assets/colors';

export const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: colors.themeColor,
  },
  createAccountText: {
    textAlign: 'center',

    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
  },
  profileButton: image => ({
    alignItems: 'center',
    marginTop: scaledValue(24),
    alignSelf: 'center',
    borderWidth: image && scaledValue(1),
    borderColor: colors.primaryBlue,
    borderRadius: scaledValue(50),
    justifyContent: 'center',
  }),
  profileImage: {
    width: scaledValue(99),
    height: scaledValue(99),
    borderRadius: scaledValue(49.5),
  },
  formContainer: {
    paddingHorizontal: scaledValue(20),
    marginTop: scaledValue(24),
    gap: scaledValue(16),
  },
  input: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingLeft: scaledValue(10),
    marginTop: scaledValue(-6),
  },
  phoneInput: {
    width: scaledValue(210),
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    // marginTop: scaledValue(20),
    paddingLeft: scaledValue(10),
  },
  cityZipContainer: {
    flexDirection: 'row',
    // marginTop: scaledValue(20),
    justifyContent: 'space-between',
  },
  cityInput: {
    width: scaledValue(163.5),
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    paddingLeft: scaledValue(10),
  },
  zipInput: {
    width: scaledValue(163.5),
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    paddingLeft: scaledValue(10),
  },
  professionalButton: {
    borderWidth: scaledValue(0.5),
    height: scaledValue(48),
    // marginTop: scaledValue(20),
    borderRadius: scaledValue(24),
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  arrowIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  scanIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
    marginRight: scaledValue(10),
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: scaledValue(38),
    paddingHorizontal: scaledValue(10),
  },

  createAccountButton: {
    backgroundColor: colors.jetBlack,
    width: '100%',
    height: scaledValue(52),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: scaledHeightValue(10),
  },
  createAccountButtonText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    color: colors.white,
  },
  memberContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: scaledValue(61),
  },
  alreadyMemberText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.03),
    color: colors.jetBlack300,
    marginHorizontal: scaledValue(5),
  },
  signInText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.03),
    color: colors.jetBlack,
    fontFamily: fonts?.SATOSHI_BOLD,
  },

  inputWrapper: {
    position: 'relative',
  },

  inlineLabelWrapper: {
    position: 'absolute',
    top: scaledValue(-7),
    left: scaledValue(20),
    backgroundColor: colors.themeColor,
    zIndex: 1,
    paddingHorizontal: scaledValue(5),
  },

  inlineLabel: {
    fontSize: scaledValue(12),
  },
});
