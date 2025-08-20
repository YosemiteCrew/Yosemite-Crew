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
  ongoingText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.appRed,
  },
  plansText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(30),
  },
  weightText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
  },
  petName: {
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(15.6),
    color: colors.jetBlack300,
  },
  percentageText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.primaryBlue,
  },
  completeText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    opacity: 0.7,
  },
  exerciseText: {
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(15.6),
    letterSpacing: scaledValue(13 * -0.01),
    marginTop: scaledValue(20),
  },
  exerciseTitle: {
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(15.6),
    opacity: 0.6,
  },
  dailyText: {
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(15.6),
    opacity: 0.6,
  },
  exerciseTextStyle: {
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(15.6),
    opacity: 0.7,
  },
  buttonTextStyle: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    color: colors.brown,
    letterSpacing: scaledValue(18 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    top: scaledValue(2),
    marginLeft: scaledValue(3),
  },
  buttonStyle: {
    marginTop: scaledValue(61),
    height: scaledValue(48),
    marginBottom: scaledValue(58),
    gap: scaledValue(8),
    width: '60%',
    alignSelf: 'center',
  },
  iconStyle: {
    width: scaledValue(20),
    height: scaledValue(20),
    marginRight: scaledValue(3),
  },
  cardStyle: {
    backgroundColor: colors.themeColor,
    borderRadius: scaledValue(20),
    paddingHorizontal: scaledValue(20),
    shadowColor: '#47382726',
    shadowOffset: {width: 1, height: 5},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    marginTop: scaledValue(20),
    borderWidth: scaledValue(1),
    borderColor: colors.jetBlack50,
  },
  imgView: {
    flexDirection: 'row',
    marginTop: scaledValue(20),
    alignItems: 'center',
  },
  petImgStyle: {width: scaledValue(40), height: scaledValue(40)},
  nameView: {marginLeft: scaledValue(8)},
  petNameView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledValue(10),
  },
  pointer: {
    width: scaledValue(4),
    height: scaledValue(4),
    borderRadius: scaledValue(10),
    backgroundColor: colors.primaryBlue,
  },
  progressView: {marginTop: scaledValue(20)},
  percentageView: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(4),
  },
  mapView: {
    marginTop: scaledValue(12),
    marginBottom: scaledValue(20),
    gap: scaledValue(20),
  },
  exerciseView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleView: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeView: (selectReminder, item) => ({
    borderRadius: scaledValue(28),
    height: scaledValue(40),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scaledValue(14),
    borderWidth: selectReminder === item ? scaledValue(1) : scaledValue(0.5),
    borderColor:
      selectReminder === item ? colors.primaryBlue : colors.darkPurple2,
    backgroundColor:
      selectReminder === item ? colors.paletteBlue : 'transparent',
  }),
  placeText: (selectReminder, item) => ({
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    textAlign: 'center',
    color: selectReminder === item ? colors.primaryBlue : colors.darkPurple2,
    fontFamily:
      selectReminder === item ? fonts.SATOSHI_BOLD : fonts.SATOSHI_REGULAR,
  }),
  reminderView: {
    marginTop: scaledValue(12),
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scaledValue(8),
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: scaledValue(16),
    paddingHorizontal: scaledValue(12),
  },
  dateText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
  },
});
