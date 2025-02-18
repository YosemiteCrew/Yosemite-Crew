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
  questionsText: {
    fontSize: scaledValue(12),
    lineHeight: scaledValue(12),
    textAlign: 'center',
    color: colors.appRed,
    marginTop: scaledValue(4),
  },
  imageBackground: {
    width: scaledValue(335),
    height: scaledValue(120),
    marginTop: scaledValue(40),
    alignSelf: 'center',
  },
  kiziImage: {
    width: scaledValue(48),
    height: scaledValue(48),
    alignSelf: 'center',
    top: scaledValue(37),
    right: scaledValue(-88),
  },
  riskHeaderContainer: {
    flexDirection: 'row',
    paddingHorizontal: scaledValue(20),
    justifyContent: 'space-between',
    marginTop: scaledValue(16),
  },
  riskText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    width: '50%',
    color: colors.darkPurple,
  },
  riskBadge: {
    flexDirection: 'row',
    backgroundColor: '#E18041',
    width: scaledValue(91),
    height: scaledValue(32),
    borderRadius: scaledValue(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskIcon: {
    width: scaledValue(16),
    height: scaledValue(16),
    marginRight: scaledValue(2),
  },
  highRiskText: {
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(14),
    letterSpacing: scaledValue(13 * -0.02),
    color: colors.white,
    marginLeft: scaledValue(2),
    top: scaledValue(1.5),
  },
  parasiteRiskProfileText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    paddingHorizontal: scaledValue(20),
    color: colors.darkPurple,
    opacity: 0.8,
    marginTop: scaledValue(40),
  },
  divider: {
    borderWidth: 1,
    borderColor: colors.darkPurple,
    opacity: 0.2,
    marginHorizontal: scaledValue(20),
    marginTop: scaledValue(8),
  },
  riskListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaledValue(20),
    justifyContent: 'space-between',
    marginTop: scaledValue(36),
  },
  riskItemText: {
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(13),
    color: colors.black,
    opacity: 0.7,
  },
  sendToVetText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.brown,
    fontFamily: fonts.CLASH_GRO_MEDIUM,
  },
  sendToVetButton: {
    marginTop: scaledValue(52),
    backgroundColor: '#FDBD74',
    height: scaledValue(52),
    marginHorizontal: scaledValue(20),
    borderRadius: scaledValue(28),
  },
  downloadPdfText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.appRed,
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    textAlign: 'center',
    marginTop: scaledValue(17),
  },
});
