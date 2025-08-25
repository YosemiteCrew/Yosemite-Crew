import {Dimensions, StyleSheet} from 'react-native';
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
  scrollView: {
    flex: 1,
  },
  headerRight: {
    paddingRight: scaledValue(20),
  },
  headerLeft: {
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: scaledValue(28),
    height: scaledValue(28),
  },
  quickActionsText: {
    fontSize: scaledValue(14),
    marginTop: scaledValue(25),
    color: colors.jetBlack300,
  },
  quickActionsWrapper: {
    justifyContent: 'space-between',
  },
  quickActionsList: {
    gap: scaledValue(16),
    marginTop: scaledValue(12),
  },
  quickActionItem: {
    backgroundColor: colors.paletteWhite,
    paddingHorizontal: scaledValue(16),
    borderRadius: scaledValue(20),
    shadowColor: '#47382726',
    shadowOffset: {width: 1, height: 5},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaledValue(15),
    borderWidth: scaledValue(1),
    borderColor: colors.jetBlack50,
    justifyContent: 'space-between',
  },
  quickActionImage: {
    width: scaledValue(40),
    height: scaledValue(40),
  },
  quickActionText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
  },
  quickActionSubText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(14 * 1.2),
    opacity: 0.7,
  },
});
