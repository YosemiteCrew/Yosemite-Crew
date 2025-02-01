import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {fonts} from '../../../utils/fonts';
import {colors} from '../../../../assets/colors';

export const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.themeColor,
    paddingHorizontal: scaledValue(20),
  },
  createAccountText: {
    textAlign: 'center',
    color: colors.darkPurple,
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
  },
  codeView: {
    justifyContent: 'center',
    borderBottomColor: 'black',
    backgroundColor: 'rgba(253, 189, 116, 0.12)',
    borderRadius: scaledValue(12),
    borderWidth: scaledValue(0.5),
    borderColor: 'rgba(55, 34, 60, 0.6)',
    marginTop: 30,
    // paddingHorizontal: scaledValue(28),
    // paddingVertical: scaledValue(10),
    width: scaledValue(50),
    height: scaledValue(56),
  },
  codeText: {
    color: '#354764',
    fontSize: scaledValue(30),
    textAlign: 'center',
    fontFamily: fonts.OPENSANS_SEMIBOLD,
    lineHeight: scaledHeightValue(40.85),
    letterSpacing: scaledValue(30 * 0.01),
  },
  rootStyle: {
    marginTop: scaledValue(20),
    justifyContent: 'space-evenly',
  },
  createAccountButton: {
    backgroundColor: '#FDBD74',
    width: '100%',
    height: scaledValue(52),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: scaledValue(27),
    marginTop: scaledValue(55),
  },
  createAccountButtonText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    color: '#4E3F2F',
  },
  backButton: {
    width: scaledValue(48),
    height: scaledValue(48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonImage: {
    width: scaledValue(28),
    height: scaledValue(28),
  },
});
