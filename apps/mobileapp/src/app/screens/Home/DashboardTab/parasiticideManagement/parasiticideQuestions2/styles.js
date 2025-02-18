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
  image: {
    width: scaledValue(64),
    height: scaledValue(64),
    alignSelf: 'center',
    marginTop: scaledValue(28),
  },
  riskText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(22.4),
    textAlign: 'center',
    color: colors.appRed,
    marginTop: scaledValue(20),
    letterSpacing: scaledValue(16 * -0.02),
  },
  descriptionText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(22.4),
    textAlign: 'center',
    marginTop: scaledValue(8),
    paddingHorizontal: scaledValue(15),
    letterSpacing: scaledValue(16 * -0.02),
  },
  separator: {
    borderWidth: scaledValue(0.5),
    borderColor: 'rgba(55, 34, 60, 0.1)',
    marginVertical: scaledValue(17),
  },
  rightArrow: {
    width: scaledValue(20),
    height: scaledValue(20),
    marginRight: scaledValue(10),
  },
  questionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  symptomsContainer: {
    marginTop: scaledValue(30.5),
    paddingHorizontal: scaledValue(20),
  },
  questionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: scaledValue(8),
  },
  symptomText: (selectedSymptoms, item) => ({
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
    marginLeft: scaledValue(8),
    width: scaledValue(245),
    color: selectedSymptoms.includes(item.symptom)
      ? colors.appRed
      : colors.darkPurple,
    fontFamily: selectedSymptoms.includes(item.symptom)
      ? fonts.SATOSHI_BOLD
      : fonts.SATOSHI_REGULAR,
  }),
  rightArrow: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: scaledValue(10),
  },
  buttonTextStyle: {
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16),
    letterSpacing: scaledValue(16 * -0.01),
    color: colors.brown,
  },
  buttonStyle: {
    width: scaledValue(100),
    height: scaledValue(44),
    borderRadius: scaledValue(28),
    backgroundColor: '#FDBD74',
    alignSelf: 'center',
    marginTop: scaledValue(34),
    marginBottom: scaledValue(28),
  },
});
