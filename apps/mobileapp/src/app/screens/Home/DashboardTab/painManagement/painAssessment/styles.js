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
  headerButton: {
    marginHorizontal: scaledValue(20),
  },
  questionsText: {
    fontSize: scaledValue(12),
    lineHeight: scaledValue(12),
    textAlign: 'center',
    color: colors.appRed,
  },
  petImg: {
    width: scaledValue(60),
    height: scaledValue(60),
    marginTop: scaledValue(28),
    alignSelf: 'center',
  },
  titleText: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(25.2),
    textAlign: 'center',
    color: colors.appRed,
    letterSpacing: scaledValue(18 * -0.02),
    marginTop: scaledValue(20),
  },
  subTitleText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    textAlign: 'center',
    color: colors.darkPurple,
    marginTop: scaledValue(8),
    paddingHorizontal: scaledValue(30),
    paddingBottom: scaledValue(30),
  },
  cardContainer: {
    marginTop: scaledValue(28),
    backgroundColor: '#FFF6EB',
    marginHorizontal: scaledValue(20),
    borderRadius: scaledValue(20),
    shadowColor: '#47382726',
    shadowOffset: {width: 10, height: 10},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 10,
    paddingHorizontal: scaledValue(20),
  },
  optionImage: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  tileView: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: scaledValue(10),
  },
  title: (select, i) => ({
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    color: select === i?.id ? colors.appRed : colors.darkPurple,
    letterSpacing: scaledValue(18 * -0.01),
  }),
  subTitle: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    color: colors.darkPurple,
    marginTop: scaledValue(6),
  },
  separator: {
    borderWidth: scaledValue(0.5),
    borderColor: 'rgba(55, 34, 60, 0.1)',
    marginVertical: scaledValue(17),
  },
  titleView: {
    width: '80%',
  },
  separatorEnd: {
    marginVertical: scaledValue(17),
  },
  createButton: {
    backgroundColor: '#FDBD74',
    width: scaledValue(335),
    height: scaledValue(52),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  buttonText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(16 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    color: colors.brown,
  },
  skipButton: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.appRed,
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    textAlign: 'center',
    marginTop: scaledValue(17),
  },
  buttonView: {marginTop: scaledValue(40), marginBottom: scaledValue(58)},
  rateText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(22.4),
    letterSpacing: scaledValue(16 * -0.01),
    color: colors.darkPurple,
    marginBottom: scaledValue(12),
  },
  innerView: {
    marginTop: scaledValue(62),
    paddingHorizontal: scaledValue(20),
  },
  editText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.appRed,
  },
  happyText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.darkPurple,
  },
  secondSeparator: {
    borderWidth: scaledValue(0.5),
    borderColor: '#000000',
    marginVertical: scaledValue(17),
  },
});
