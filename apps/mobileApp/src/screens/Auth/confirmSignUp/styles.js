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

    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
  },
  codeView: {
    justifyContent: 'center',
    borderBottomColor: 'black',
    backgroundColor: 'transparent',
    borderRadius: scaledValue(12),
    borderWidth: scaledValue(0.5),
    borderColor: 'rgba(55, 34, 60, 0.6)',
    marginTop: scaledValue(16),
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
    justifyContent: 'space-evenly',
  },
  createAccountButton: {
    width: '100%',
    marginTop: scaledValue(97),
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
  modalView: {
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
