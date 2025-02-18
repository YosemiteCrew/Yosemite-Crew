import {StyleSheet} from 'react-native';
import {scaledValue} from '../../../../../../utils/design.utils';
import {colors} from '../../../../../../../assets/colors';
import {fonts} from '../../../../../../utils/fonts';

export const styles = StyleSheet.create({
  mainContainer: {
    backgroundColor: '#FFFBFE',
  },
  circleClose: {
    width: scaledValue(22),
    height: scaledValue(22),
    alignSelf: 'flex-end',
    marginTop: scaledValue(20),
    marginRight: scaledValue(20),
  },
  assessmentFeeText: {
    fontSize: scaledValue(20),
    lineHeight: scaledValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.jetBlack,
    marginBottom: scaledValue(24),
  },
  petDetailView: {flexDirection: 'row', marginBottom: scaledValue(24)},
  petImage: {width: scaledValue(60), height: scaledValue(60)},
  diabetesText: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.jetBlack,
  },
  dateTimeText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.jetBlack300,
  },
  feeBreakdownTextView: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaledValue(4),
  },
  widgetBold: {
    width: scaledValue(16),
    height: scaledValue(16),
    marginRight: scaledValue(4),
  },
  feeBreakdownText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.jetBlack,
  },
  feeListView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: scaledValue(8),
    paddingRight: scaledValue(16),
    paddingVertical: scaledValue(13.5),
  },
  listItemText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    color: colors.jetLightBlack,
  },
  feeText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    color: colors.jetLightBlack,
    marginRight: scaledValue(4),
  },
  usdText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    color: colors.jetBlack300,
  },
  totalText: {
    fontSize: scaledValue(20),
    lineHeight: scaledValue(24),
    color: colors.appRed,
    letterSpacing: scaledValue(20 * -0.01),
  },
  totalAmountText: {
    fontSize: scaledValue(20),
    lineHeight: scaledValue(24),
    color: colors.appRed,
    letterSpacing: scaledValue(20 * -0.01),
    marginRight: scaledValue(4),
  },
  totalAmoundUsdText: {
    fontSize: scaledValue(20),
    lineHeight: scaledValue(24),
    color: colors.jetBlack300,
    letterSpacing: scaledValue(20 * -0.01),
  },
  buttonView: insets => ({
    marginBottom: insets?.bottom,
  }),
  buttonText: {
    fontSize: scaledValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.pearlWhite,
    lineHeight: scaledValue(21.6),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
  },
  buttonStyle: {
    backgroundColor: colors.appRed,
    height: scaledValue(52),
    borderRadius: scaledValue(28),
  },
});
