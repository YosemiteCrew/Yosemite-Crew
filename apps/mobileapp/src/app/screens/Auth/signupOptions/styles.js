import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {fonts} from '../../../utils/fonts';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF2E3',
  },
  signupImage: {
    width: '100%',
    height: scaledValue(332),
  },
  headerContainer: {
    flexDirection: 'row',
    marginTop: scaledValue(12),
    justifyContent: 'center',
  },
  tailWaggingText: {
    color: '#D04122',
    fontSize: scaledValue(29),
    lineHeight: scaledHeightValue(34.8),
    letterSpacing: scaledValue(29 * -0.01),
  },
  welcomeText: {
    color: '#37223C',
    fontSize: scaledValue(29),
    lineHeight: scaledHeightValue(34.8),
    letterSpacing: scaledValue(29 * -0.01),
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
    width: scaledValue(300),
    height: scaledValue(56),
    alignSelf: 'center',
    borderRadius: scaledValue(28),
    marginTop: scaledValue(12),
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
    color: '#312943',
    marginHorizontal: scaledValue(5),
  },
  signInText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.03),
    color: '#D04122',
    fontFamily: fonts?.SATOSHI_BOLD,
  },
});
