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
  petImage: {
    width: scaledValue(80),
    height: scaledValue(80),
  },
  petNameText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    marginTop: scaledValue(4),
    letterSpacing: scaledValue(16 * -0.02),
    color: colors.darkPurple,
    textAlign: 'center',
  },
  healthyStatus: {
    flexDirection: 'row',
    backgroundColor: '#8AC1B1',
    paddingHorizontal: scaledValue(10),
    height: scaledValue(24),
    alignItems: 'center',
    borderRadius: scaledValue(20),
    marginTop: scaledValue(4),
  },
  riskStatus: {
    flexDirection: 'row',
    backgroundColor: '#FDBD74',
    paddingHorizontal: scaledValue(10),
    height: scaledValue(24),
    alignItems: 'center',
    borderRadius: scaledValue(20),
    marginTop: scaledValue(4),
  },
  statusIcon: {
    width: scaledValue(12),
    height: scaledValue(12),
    marginRight: scaledValue(1),
  },
  statusText: {
    fontSize: scaledValue(12),
    lineHeight: scaledHeightValue(13),
    letterSpacing: scaledValue(12 * -0.02),
    color: colors.white,
    marginLeft: scaledValue(1),
    top: scaledValue(1),
  },
  petItem: {alignItems: 'center'},
  petList: {
    gap: scaledValue(11),
  },
  quickActionsText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    marginTop: scaledValue(36),
    opacity: 0.6,
  },
  quickActionItem: {
    backgroundColor: '#FFF6EB',
    width: Dimensions.get('window').width / 2 - scaledValue(30),
    // height: scaledValue(157),
    paddingHorizontal: scaledValue(16),
    borderRadius: scaledValue(20),
    shadowColor: '#47382726',
    shadowOffset: {width: 1, height: 5},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    paddingBottom: scaledValue(20),
  },
  quickActionImage: {
    width: scaledValue(40),
    height: scaledValue(40),
    marginTop: scaledValue(39),
  },
  quickActionText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    marginTop: scaledValue(14),
    letterSpacing: scaledValue(18 * -0.01),
  },
  divider: {
    borderWidth: scaledValue(0.5),
    borderColor: 'rgba(55, 34, 60, 0.1)',
    marginVertical: scaledValue(17),
  },
  imgStyle: {
    width: scaledValue(40),
    height: scaledValue(40),
  },
  optionView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrowImg: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  titleStyle: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.darkPurple,
    marginLeft: scaledValue(10),
  },
  imgTitleView: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateStyle: {
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(15.6),
    color: colors.darkPurple,
    marginLeft: scaledValue(10),
    opacity: 0.6,
  },
  headerContainer: {
    flexDirection: 'row',
    marginTop: scaledValue(30),
    alignItems: 'center',
  },
  shieldImage: {
    width: scaledValue(40),
    height: scaledValue(40),
  },
  upcomingVaccinationContainer: {
    marginLeft: scaledValue(4),
  },
  upcomingVaccinationText: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.appRed,
  },
  dueOnText: {
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(15.6),
    letterSpacing: scaledValue(13 * -0.01),
    color: colors.darkPurple,
    opacity: 0.6,
  },
  vaccinationStatusText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.darkPurple,
    marginTop: scaledValue(39),
  },
  petListContainer: {
    marginTop: scaledValue(12),
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: scaledValue(17),
    marginTop: scaledValue(12),
  },
  recentVaccinationsContainer: {
    marginTop: scaledValue(28),
    marginBottom: scaledValue(50),
  },
  dividerSpacing: {
    marginVertical: scaledValue(17),
  },
});
