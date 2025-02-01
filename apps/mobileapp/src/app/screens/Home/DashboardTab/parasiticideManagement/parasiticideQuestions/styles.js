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
  completeQuestionsText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    opacity: 0.6,
    textAlign: 'center',
    marginTop: scaledValue(4),
    paddingHorizontal: scaledValue(71),
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
  descriptionText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(22.4),
    textAlign: 'center',
    marginTop: scaledValue(20),
    paddingHorizontal: scaledValue(15),
    letterSpacing: scaledValue(16 * -0.02),
  },
  buttonContainer: {
    alignItems: 'center',
    gap: scaledValue(12),
    marginTop: scaledValue(20),
    marginBottom: scaledValue(28),
  },
  button: {
    backgroundColor: '#FDBD74',
    height: scaledValue(52),
    width: scaledValue(240),
    borderRadius: scaledValue(28),
  },
  buttonText: {
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    fontSize: scaledValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    lineHeight: scaledHeightValue(18),
    color: colors.brown,
  },
});
