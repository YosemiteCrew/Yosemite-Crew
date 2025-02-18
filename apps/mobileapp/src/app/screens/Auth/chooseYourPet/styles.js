import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {fonts} from '../../../utils/fonts';
import {colors} from '../../../../assets/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.themeColor,
  },
  title: {
    fontSize: scaledValue(26),
    lineHeight: scaledHeightValue(31.2),
    letterSpacing: scaledValue(26 * -0.01),
    textAlign: 'center',
    marginTop: scaledValue(18),
    color: colors.darkPurple,
  },
  subtitle: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.01),
    textAlign: 'center',
    marginTop: scaledValue(8),
    color: colors.darkPurple,
    paddingHorizontal: scaledValue(65),
  },
  petListContainer: {
    flexDirection: 'row',
    marginTop: scaledValue(95),
    paddingHorizontal: scaledValue(20),
    justifyContent: 'space-between',
  },
  petItem: {
    alignItems: 'center',
  },
  petTitle: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.darkPurple,
  },
  button: {
    backgroundColor: '#FDBD74',
    width: '90%',
    height: scaledValue(52),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: scaledValue(27),
    position: 'absolute',
    bottom: scaledValue(18),
  },
  buttonText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    color: colors.brown,
  },
});
