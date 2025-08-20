import {Dimensions, StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {fonts} from '../../../utils/fonts';
import {colors} from '../../../../assets/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paletteWhite,
  },
  signupImage: {
    width: '100%',
    height: scaledValue(285),
  },
  headerContainer: {
    flexDirection: 'row',
    marginTop: scaledValue(54),
    justifyContent: 'center',
  },
  tailWaggingText: {
    fontSize: scaledValue(26),
    letterSpacing: scaledValue(26 * -0.01),
  },
  welcomeText: {
    color: colors.jetBlack300,
    fontSize: scaledValue(26),
    letterSpacing: scaledValue(26 * -0.01),
  },
  buttonContainer: {
    marginTop: scaledValue(12),
  },
  iconStyle: {
    width: scaledValue(24),
    height: scaledValue(24),
    marginRight: scaledValue(6),
  },
  button: {
    height: scaledValue(56),
    alignSelf: 'center',
    borderRadius: scaledValue(28),
    marginTop: scaledValue(12),
    width: Dimensions.get('window').width - scaledValue(74),
  },
  googleButtonBorder: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  buttonText: {
    fontSize: scaledValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    marginLeft: scaledValue(6),
  },
  memberContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: scaledValue(24),
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
    color: colors.black,
    fontFamily: fonts?.SATOSHI_BOLD,
  },
});
