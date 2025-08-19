import { StyleSheet } from 'react-native';
import { colors } from '../../../../../../assets/colors';
import {
  scaledHeightValue,
  scaledValue,
} from '../../../../../utils/design.utils';
import { fonts } from '../../../../../utils/fonts';

export const styles = StyleSheet.create({
  dashboardMainView: {
    flex: 1,
    backgroundColor: colors.themeColor,
  },
  scrollView: {
    flex: 1,
  },
  headerRight: {
    paddingRight: scaledHeightValue(20),
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
  questionsContainer: {
    marginTop: scaledValue(20),
  },
  questionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  questionText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
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
  container: {
    paddingHorizontal: scaledValue(20),
    borderRadius: scaledValue(20),
    shadowColor: '##47382714',
    shadowOffset: { width: 6, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: scaledValue(1),
    borderColor: colors.paletteWhite,
    backgroundColor: colors.themeColor,
    shadowColor: '##47382714',
    marginHorizontal: scaledValue(20),
    padding: scaledValue(12),
    marginTop: scaledValue(20),
  },
  questionTitle: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.jetBlack,
    marginTop: scaledValue(20),
  },
  descriptionText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(21),
    marginTop: scaledValue(8),
    color: colors.jetLightBlack

  },
  helperText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    marginTop: scaledValue(24),
    color: colors.jetLightBlack
  },
  buttonContainer: {
    gap: scaledValue(8),
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(12),
    marginBottom: scaledValue(20),
  },
  button: {
    borderWidth: scaledValue(1),
    width: scaledValue(80),
    height: scaledValue(38),
    borderRadius: scaledValue(28),
    backgroundColor: 'transparent',
    borderColor: colors.jetBlack,
  },
  buttonText: {
    color: colors.jetBlack,
    fontSize: scaledValue(14),
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    letterSpacing: scaledValue(14 * -0.01),
    lineHeight: scaledHeightValue(14),
  },
  relatedQuestionsContainer: {
    marginTop: scaledValue(48),
    paddingHorizontal: scaledValue(21),
  },
  relatedQuestionText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
  },
});
