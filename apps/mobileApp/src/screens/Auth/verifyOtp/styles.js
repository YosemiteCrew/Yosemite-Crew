import { Dimensions, Platform, StyleSheet } from 'react-native';
import { scaledHeightValue, scaledValue } from '../../../utils/design.utils';
import { fonts } from '../../../utils/fonts';
import { colors } from '../../../../assets/colors';
import { greyCrossIcon, verification_modal } from '../../../utils/Images';

export const styles = StyleSheet.create({
  codeView: {
    // paddingHorizontal: scaledValue(28),
    width: scaledValue(50),
    height: scaledValue(56),
    justifyContent: 'center',
    borderBottomColor: 'black',
    // backgroundColor: 'rgba(253, 189, 116, 0.12)',
    borderRadius: scaledValue(12),
    borderWidth: scaledValue(0.5),
    borderColor: colors.jetBlack200,
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
    marginTop: scaledValue(16),
    justifyContent: 'space-evenly',
  },
  socialButton: {
    height: scaledValue(52),
    marginTop: scaledValue(97),
    backgroundColor: colors.jetBlack,
    borderRadius: scaledValue(28),
  },
  notMemberContainer: {
    marginTop: scaledValue(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpText: {

    fontFamily: fonts?.SATOSHI_BOLD,
  },
  notMemberText: {
    fontSize: scaledValue(16),
    color: colors.jetBlack300,
  },
  socialButtonText: {
    fontSize: scaledValue(18),
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    letterSpacing: scaledValue(18 * -0.01),
  },
  modalView: {
    // height: scaledHeightValue(432),
    backgroundColor: colors.white,
    paddingVertical: scaledValue(20),
    borderRadius: scaledValue(24),
  },
  modalHeader: {
    textAlign: 'center',
    fontSize: scaledValue(23),
    color: colors.black,
    letterSpacing: scaledValue(23 * -0.01),
    lineHeight: scaledValue(23 * 1.2),
  },
  modalContent: {
    fontSize: scaledValue(16),
    fontFamily: fonts.SATOSHI_REGULAR,
    textAlign: 'center',
    letterSpacing: scaledValue(16 * -0.02),
    lineHeight: scaledValue(16 * 1.4),
    marginTop: scaledValue(8),
    paddingBottom: scaledValue(10),
  },
  emailText: {
    fontFamily: fonts.SATOSHI_BOLD,
  },
  verificationModal: {
    height: scaledValue(199),
    width: scaledValue(192),
    alignSelf: 'center',
  },
  greyCrossIcon: {
    height: scaledValue(22),
    width: scaledValue(22),
  },
});
