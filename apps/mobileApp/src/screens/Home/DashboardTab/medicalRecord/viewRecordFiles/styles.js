import {StyleSheet} from 'react-native';
import {
  scaledHeightValue,
  scaledValue,
} from '../../../../../utils/design.utils';
import {colors} from '../../../../../../assets/colors';

export const styles = StyleSheet.create({
  dashboardMainView: {
    flex: 1,
    backgroundColor: colors.themeColor,
    paddingHorizontal: scaledValue(20),
  },
  shareIcon: {
    height: 28,
    width: 28,
    tintColor: colors.jetBlack,
  },
  editIcon: {
    height: 28,
    width: 28,
    tintColor: colors.jetBlack,
  },
  trashIcon: {
    height: 28,
    width: 28,
    tintColor: colors.jetBlack,
  },
  buttonsView: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: scaledValue(40),
    marginHorizontal: scaledValue(75),
    marginTop: scaledValue(7),
  },
  greyBg: {
    height: scaledValue(48),
    width: scaledValue(48),
    backgroundColor: colors.jetBlack50,
    borderRadius: scaledValue(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonsText: {
    textAlign: 'center',
    mmarginTop: scaledValue(4),
    fontSize: scaledValue(14),
  },
});
