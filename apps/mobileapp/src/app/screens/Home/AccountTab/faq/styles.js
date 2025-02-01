import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../../utils/design.utils';
import {colors} from '../../../../../assets/colors';

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
    marginTop: scaledValue(20),
  },
  optionContainer: {
    flexDirection: 'row',
    gap: scaledValue(4),
    paddingLeft: scaledValue(20),
  },
  optionButton: {
    height: scaledValue(35),
    borderRadius: scaledValue(24),
    justifyContent: 'center',
    paddingHorizontal: scaledValue(18),
    borderColor: colors.appRed,
  },
  optionText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    letterSpacing: scaledValue(16 * -0.01),
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
    marginLeft: scaledValue(8),
    width: '90%',
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
});
