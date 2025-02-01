import {StyleSheet} from 'react-native';
import {colors} from '../../../../../../assets/colors';
import {
  scaledHeightValue,
  scaledValue,
} from '../../../../../utils/design.utils';
import {fonts} from '../../../../../utils/fonts';

export const styles = StyleSheet.create({
  dashboardMainView: {
    flex: 1,
    backgroundColor: colors.themeColor,
  },
  headerTitle: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    textAlign: 'center',
    opacity: 0.8,
  },
  headerSubTitleView: {
    paddingHorizontal: scaledValue(70),
    marginBottom: scaledValue(32),
  },
  vetOptionButtonView: {
    backgroundColor: '#D041221A',
    width: scaledValue(213),
    alignSelf: 'center',
    flexDirection: 'row',
    paddingHorizontal: scaledValue(2),
    paddingVertical: scaledValue(2),
    borderRadius: scaledValue(20),
    justifyContent: 'space-between',
    marginBottom: scaledValue(20),
  },
  vetOptionButton: {
    backgroundColor: colors.appRed,
    borderRadius: scaledValue(20),
    paddingHorizontal: scaledValue(16),
    paddingVertical: scaledValue(8),
  },
  vetOptionButtonText: {
    fontSize: scaledValue(16),
    letterSpacing: scaledValue(16 * -0.01),
    color: colors.pearlWhite,
  },
  contentContainerStyle: {
    marginHorizontal: scaledValue(20),
    gap: scaledValue(12),
    marginBottom: scaledValue(5),
  },
  checkFill: {width: scaledValue(24), height: scaledValue(24)},
  buttonView: insets => ({
    paddingHorizontal: scaledValue(20),
    marginBottom: insets.bottom + scaledValue(30),
  }),
  buttonText: {
    fontSize: scaledValue(18),
    // lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.brown,
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
  },
  buttonStyle: {
    backgroundColor: '#FDBD74',
    marginTop: scaledValue(16),
    height: scaledValue(52),
    borderRadius: scaledValue(28),
  },
  almostThereText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.jetBlack,
    textAlign: 'center',
  },
  reviewCompletePaymentText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.jetLightBlack,
    textAlign: 'center',
  },
});
