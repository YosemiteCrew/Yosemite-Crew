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
  headerContainer: {
    flexDirection: 'row',
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
  reminderText: {
    fontSize: scaledValue(11),
    lineHeight: scaledHeightValue(13.2),
    color: colors.darkPurple,
    marginTop: scaledValue(4),
  },
  titleText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    marginTop: scaledValue(40),
    opacity: 0.6,
  },
  divider: {
    borderWidth: scaledValue(0.5),
    borderColor: 'rgba(55, 34, 60, 0.1)',
    marginVertical: scaledValue(17),
  },
  iconStyle: {width: scaledValue(16), height: scaledValue(16)},
  buttonStyle: {
    backgroundColor: '#FDBD74',
    width: scaledValue(198),
    height: scaledValue(48),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: scaledValue(40),
    marginBottom: scaledValue(40),
  },
  buttonText: {
    fontSize: scaledValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    marginLeft: scaledValue(6),
    color: colors.brown,
  },
  container: {
    marginTop: scaledValue(20),
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  diseaseText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16),
    color: colors.darkPurple,
  },
  statusImage: {
    width: scaledValue(16),
    height: scaledValue(16),
    marginLeft: scaledValue(5),
  },
  nameText: {
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(15.6),
    color: colors.darkPurple,
    opacity: 0.6,
    marginTop: scaledValue(2),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledValue(8),
    marginTop: scaledValue(8),
  },
  dateText: {
    fontSize: scaledValue(11),
    lineHeight: scaledHeightValue(13.2),
    color: colors.darkPurple,
    opacity: 0.6,
  },
  dot: {
    width: scaledValue(4),
    height: scaledValue(4),
    borderRadius: scaledValue(10),
    backgroundColor: colors.appRed,
  },
  clinicText: {
    fontSize: scaledValue(11),
    lineHeight: scaledHeightValue(13.2),
    color: colors.darkPurple,
    opacity: 0.6,
  },
  itemImage: {
    width: scaledValue(64),
    height: scaledValue(58),
  },
  innerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: scaledValue(30),
  },
  row: {
    flexDirection: 'row',
  },
  oscarText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.appRed,
  },
  vaccinationText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.darkPurple,
  },
  recordsText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.darkPurple,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catImage: {
    width: scaledValue(40),
    height: scaledValue(40),
  },
  arrowImage: {
    width: scaledValue(16),
    height: scaledValue(16),
  },
});
