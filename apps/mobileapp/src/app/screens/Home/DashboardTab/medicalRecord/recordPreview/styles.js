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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: scaledValue(30),
  },
  titleText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.darkPurple,
  },
  iconRow: {
    flexDirection: 'row',
    gap: scaledValue(16),
  },
  icon: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  issuedRow: {
    flexDirection: 'row',
    marginTop: scaledValue(4),
  },
  issuedText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    letterSpacing: scaledValue(14 * -0.02),
    color: '#37223C80',
  },
  dateText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    letterSpacing: scaledValue(14 * -0.02),
    color: colors.darkPurple,
  },
  swiperContainer: {
    height: '60%',
  },
  swiperSlide: {
    flex: 1,
  },
  invoiceImage: {
    width: scaledValue(335),
    height: scaledValue(437),
  },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: scaledValue(12),
  },
  navIcon: {
    opacity: 0.2,
    width: scaledValue(28),
    height: scaledValue(28),
  },
  navIconRotated: {
    width: scaledValue(28),
    height: scaledValue(28),
    transform: [{rotate: '180deg'}],
  },
  pageIndicator: {
    flexDirection: 'row',
  },
  pageText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    color: colors.appRed,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: scaledValue(40),
    marginTop: scaledValue(27),
    alignSelf: 'center',
  },
  buttonWrapper: {
    alignItems: 'center',
  },
  button: {
    width: scaledValue(48),
    height: scaledValue(48),
    backgroundColor: '#D041221A',
    borderRadius: scaledValue(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    width: scaledValue(28),
    height: scaledValue(28),
  },
  buttonText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.appRed,
    marginTop: scaledValue(4),
  },
});
