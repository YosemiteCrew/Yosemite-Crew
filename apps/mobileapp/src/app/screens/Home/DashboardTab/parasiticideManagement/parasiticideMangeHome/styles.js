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
  scrollView: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    width: scaledValue(187),
    height: scaledValue(36),
    backgroundColor: '#D041221A',
    borderRadius: scaledValue(20),
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: scaledValue(2),
    marginTop: scaledValue(12),
  },
  tabButton: {
    width: scaledValue(93),
    height: scaledValue(32),
    borderRadius: scaledValue(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedTabButton: {
    backgroundColor: colors.appRed,
  },
  tabText: {
    color: '#302F2E',
  },
  highRiskContainer: {
    backgroundColor: colors.appRed,
    height: scaledValue(60.39),
    alignItems: 'center',
    marginHorizontal: scaledValue(20),
    marginTop: scaledValue(24),
    borderRadius: scaledValue(12),
  },
  highRiskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(8),
  },
  bugIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
    marginRight: scaledValue(4),
  },
  highRiskText: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.white,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(4.2),
  },
  arrowIcon: {
    width: scaledValue(12),
    height: scaledValue(12),
  },
  locationText: {
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(15.6),
    color: '#FFF2E3',
  },
  vigilanceText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    opacity: 0.6,
    paddingHorizontal: scaledValue(21),
    textAlign: 'center',
    marginTop: scaledValue(12),
  },
  mapImage: {
    width: scaledValue(335),
    height: scaledValue(208),
    marginTop: scaledValue(24),
    alignSelf: 'center',
  },
  parasiteRiskButton: {
    marginTop: scaledValue(38.61),
    backgroundColor: '#FFF6EB',
    marginHorizontal: scaledValue(20),
    borderRadius: scaledValue(20),
    marginBottom: scaledValue(51),
    shadowColor: '#47382726',
    shadowOffset: {width: 10, height: 10},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 10,
  },
  parasiteIcon: {
    width: scaledValue(40),
    height: scaledValue(40),
    marginTop: scaledValue(24),
    alignSelf: 'center',
  },
  parasiteRiskText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    color: colors.darkPurple,
    textAlign: 'center',
    marginTop: scaledValue(16),
  },
  evaluateText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    opacity: 0.8,
    paddingHorizontal: scaledValue(35),
    textAlign: 'center',
    marginTop: scaledValue(4),
  },
  petList: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: scaledValue(16),
    gap: scaledValue(11.5),
    marginBottom: scaledValue(24),
  },
  petImage: {
    width: scaledValue(80),
    height: scaledValue(80),
  },
  petName: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    color: colors.darkPurple,
    textAlign: 'center',
    marginTop: scaledValue(4),
    letterSpacing: scaledValue(16 * -0.02),
  },
});
