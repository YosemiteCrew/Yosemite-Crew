import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../../utils/design.utils';
import {colors} from '../../../../../assets/colors';
import {fonts} from '../../../../utils/fonts';

export const styles = StyleSheet.create({
  dashboardMainView: {
    flex: 1,
    backgroundColor: colors.themeColor,
  },

  profileButton: {
    alignItems: 'center',
    marginTop: scaledValue(24),
    alignSelf: 'center',
  },
  profileImage: {
    width: scaledValue(100),
    height: scaledValue(100),
    borderRadius: scaledValue(50),
    borderWidth: scaledValue(1),
    borderColor: colors.primaryBlue,
  },
  formContainer: {
    paddingHorizontal: scaledValue(20),
    marginTop: scaledValue(30),
    gap: scaledValue(16),
  },
  input: {
    width: '100%',
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    paddingLeft: scaledValue(10),
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
    justifyContent: 'space-between',
  },
  cityInput: {
    width: scaledValue(163.5),
    backgroundColor: 'transparent',
    paddingLeft: scaledValue(10),
  },
  zipInput: {
    width: scaledValue(163.5),
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    // lineHeight: scaledValue(16),
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
    letterSpacing: scaledValue(16 * -0.02),
    color: '#37223C',
    flexShrink: 1,
    fontFamily: fonts?.SATOSHI_REGULAR,
    left: scaledValue(10),
  },
  link: {
    fontSize: scaledValue(16),
    letterSpacing: scaledValue(16 * -0.02),
    color: '#D04122',
    flexShrink: 1,
    fontFamily: fonts?.SATOSHI_MEDIUM,
  },
  createAccountButton: {
    width: '100%',
    marginVertical: scaledValue(30),
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
  dateText: val => ({
    fontSize: scaledValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    fontFamily: val ? fonts.SATOSHI_MEDIUM : fonts.SATOSHI_REGULAR,
  }),
});
