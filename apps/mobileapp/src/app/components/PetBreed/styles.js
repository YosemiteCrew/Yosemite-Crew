import {Dimensions, Platform, StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../utils/design.utils';
import {colors} from '../../../assets/colors';
import {fonts} from '../../utils/fonts';

export const styles = StyleSheet.create({
  rbsheetContainer: {
    backgroundColor: '#FFF2E3',
    borderTopLeftRadius: scaledValue(28),
    borderTopRightRadius: scaledValue(28),
  },
  headerContainer: {
    marginBottom: scaledValue(12),
    paddingHorizontal: scaledValue(20),
  },
  closeButton: {
    marginTop: scaledHeightValue(12.83),
    alignSelf: 'flex-end',
  },
  closeIcon: {
    width: scaledValue(24),
    height: scaledValue(24),
  },
  dogImage: {
    width: scaledValue(64),
    height: scaledValue(62.83),
    alignSelf: 'center',
  },
  titleText: {
    textAlign: 'center',
    marginTop: scaledValue(12),
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.darkPurple,
    marginBottom: scaledValue(12),
  },
  textInputOutline: {
    borderWidth: 0.5,
    borderRadius: scaledValue(24),
    marginBottom: scaledValue(8),
    height: scaledValue(48),
    borderColor: 'Search from 200+ breeds',
  },
  textInput: {
    backgroundColor: 'transparent',
    paddingLeft: scaledValue(10),
  },
  searchIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  optionsContainer: {
    paddingHorizontal: scaledValue(20),
  },
  optionContainer: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
  },
  optionTextSelected: {
    color: colors.appRed,
    fontFamily: fonts?.SATOSHI_BOLD,
  },
  optionTextDefault: {
    color: colors.darkPurple,
    fontFamily: fonts?.SATOSHI_REGULAR,
  },
  optionWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionImage: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(55, 34, 60, 0.1)',
    width: '100%',
    alignSelf: 'center',
  },
  continueButton: {
    backgroundColor: '#FDBD74',
    width: '90%',
    height: scaledValue(52),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: scaledValue(27),
    marginTop: scaledValue(10),
  },
  continueButtonText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    color: colors.brown,
  },
});
