import {StyleSheet} from 'react-native';
import {
  scaledHeightValue,
  scaledValue,
} from '../../../../../utils/design.utils';
import {fonts} from '../../../../../utils/fonts';
import {colors} from '../../../../../../assets/colors';

export const styles = StyleSheet.create({
  dashboardMainView: {
    flex: 1,
    backgroundColor: colors.themeColor,
    paddingHorizontal: scaledValue(17),
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledValue(4),
  },
  catImage: {
    width: scaledValue(40),
    height: scaledValue(40),
    borderRadius: scaledValue(20),
    borderWidth: 1,
    borderColor: colors.primaryBlue,
  },
  arrowImage: {
    width: scaledValue(16),
    height: scaledValue(16),
  },
  inputStyle: {
    width: '100%',
    backgroundColor: 'transparent',
    marginTop: scaledValue(17),
    paddingLeft: scaledValue(10),
  },
});
