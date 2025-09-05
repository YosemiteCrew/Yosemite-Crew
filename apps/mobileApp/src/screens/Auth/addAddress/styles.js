import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {colors} from '../../../../assets/colors';
import {fonts} from '../../../utils/fonts';

export const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.themeColor,
  },
  createAccountText: {
    textAlign: 'center',
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
  },
  profileButton: {
    alignItems: 'center',
    marginTop: scaledValue(24),
    alignSelf: 'center',
    borderWidth: scaledValue(1),
    borderColor: colors.primaryBlue,
    borderRadius: scaledValue(50),
    justifyContent: 'center',
  },
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
  },
  phoneInput: {
    width: scaledValue(210),
    backgroundColor: 'transparent',
    paddingLeft: scaledValue(10),
  },
  cityZipContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cityInput: {
    width: scaledValue(163.5),
    backgroundColor: 'transparent',
    paddingLeft: scaledValue(10),
    marginTop: scaledValue(-6),
  },
  zipInput: {
    width: scaledValue(163.5),
    backgroundColor: 'transparent',
    paddingLeft: scaledValue(10),
    marginTop: scaledValue(-6),
  },
  professionalButton: {
    borderWidth: scaledValue(0.5),
    height: scaledValue(48),

    borderRadius: scaledValue(24),
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  professionalText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    color: '#312943',
  },
  pimsButton: {
    borderWidth: scaledValue(0.5),
    height: scaledValue(48),
    marginTop: scaledValue(20),
    borderRadius: scaledValue(24),
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pimsText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    color: '#312943',
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
    marginVertical: scaledValue(20),
    paddingHorizontal: scaledValue(10),
  },
  checkboxContainer: {
    flexDirection: 'row',
    width: '100%',
  },
  checkboxIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  text: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
    color: colors.jetBlack300,
    flexShrink: 1,
    fontFamily: fonts?.SATOSHI_REGULAR,
    left: scaledValue(10),
  },
  link: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
    color: colors.primaryBlue,
    flexShrink: 1,
    fontFamily: fonts?.SATOSHI_BOLD,
  },
  createAccountButton: {
    backgroundColor: colors.jetBlack,
    width: '100%',
    height: scaledValue(52),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
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
  headerText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18 * 1.2),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.jetBlack,
    paddingLeft: scaledValue(20),
    marginTop: scaledValue(40),
  },
  rightIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
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
