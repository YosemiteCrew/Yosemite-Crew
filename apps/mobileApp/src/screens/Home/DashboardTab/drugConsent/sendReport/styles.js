import {StyleSheet} from 'react-native';
import {scaledValue} from '../../../../../utils/design.utils';
import {colors} from '../../../../../../assets/colors';
import {Checkbox} from 'react-native-paper';

export const styles = StyleSheet.create({
  girlWithBird: {
    height: scaledValue(222),
    width: scaledValue(240.6),
    resizeMode: 'contain',
    marginTop: 28,
    alignSelf: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: colors.themeColor,
  },
  titleText: {
    fontSize: scaledValue(20),
    lineHeight: scaledValue(20 * 1.2),
    letterSpacing: scaledValue(20 * -0.01),
    marginVertical: scaledValue(16),
    textAlign: 'center',
  },
  desText: {
    fontSize: scaledValue(15),
    marginHorizontal: scaledValue(20),
    color: colors.jetLightBlack,
  },
  checkboxText: {
    fontSize: scaledValue(15),
    lineHeight: scaledValue(15 * 1.2),
    letterSpacing: scaledValue(15 * -0.02),
    color: colors.jetLightBlack,
  },
  checkboxView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledValue(12),
    marginHorizontal: scaledValue(20),
    marginTop: scaledValue(16),
  },
  checkboxImg: {
    height: scaledValue(20),
    width: scaledValue(20),
  },
  sendButtonPharma: {
    marginHorizontal: scaledValue(20),
    marginTop: scaledValue(69),
  },
  sendButtonVet: {
    marginHorizontal: scaledValue(20),
    marginTop: scaledValue(20),
    backgroundColor: colors.themeColor,
    borderWidth: scaledValue(1),
    borderColor: colors.jetBlack,
  },
  sendText: {
    color: colors.jetBlack,
  },
  phoneImg: {
    height: scaledValue(20),
    width: scaledValue(20),
  },
  callText: {
    fontSize: scaledValue(18),
    letterSpacing: scaledValue(18 * -0.02),
  },
  callView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledValue(8),
    marginTop: scaledValue(36),
    alignSelf: 'center',
  },
});
