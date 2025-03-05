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
  },
  petImg: {
    width: scaledValue(60),
    height: scaledValue(60),
    marginTop: scaledValue(28),
    alignSelf: 'center',
  },
  recommendedText: {
    fontSize: scaledValue(20),
    lineHeight: scaledValue(24),
    textAlign: 'center',
    color: colors.appRed,
    letterSpacing: scaledValue(20 * -0.01),
    marginTop: scaledValue(20),
  },
  basedText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    textAlign: 'center',
    color: colors.darkPurple,
    marginTop: scaledValue(8),
    paddingHorizontal: scaledValue(10),
  },
  questionsContainer: {
    marginTop: scaledValue(44),
    paddingHorizontal: scaledValue(21),
  },
  questionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  questionText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
    color: colors.darkPurple,
  },
  rightArrow: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  separator: {
    borderWidth: scaledValue(0.5),
    borderColor: 'rgba(55, 34, 60, 0.1)',
    marginVertical: scaledValue(17),
  },
  separatorEnd: {
    marginVertical: scaledValue(17),
  },
  subTitleText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
  },
  exerciseText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    marginTop: scaledValue(40),
    opacity: 0.6,
  },
  exerciseView: {paddingHorizontal: scaledValue(20)},
  exerciseContainer: {
    flexDirection: 'row',
    marginTop: scaledValue(16),
  },
  videoThumbnail: {
    width: scaledValue(132),
    height: scaledValue(80),
  },
  exerciseDetails: {
    marginLeft: scaledValue(8),
    marginTop: scaledValue(8),
  },
  exerciseTitle: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
  },
  exerciseStatus: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    opacity: 0.8,
    color: colors.darkPurple,
  },
  textView: {
    flexDirection: 'row',
    gap: scaledValue(2),
    alignItems: 'center',
    marginTop: scaledValue(4),
  },
  statusText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
  },
  createButton: {
    backgroundColor: '#FDBD74',
    width: scaledValue(335),
    height: scaledValue(52),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: scaledValue(68),
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
    marginBottom: scaledValue(50),
  },
});
