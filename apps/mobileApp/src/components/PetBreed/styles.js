import { Dimensions, Platform, StyleSheet } from 'react-native';
import { scaledHeightValue, scaledValue } from '../../utils/design.utils';
import { colors } from '../../../assets/colors';
import { fonts } from '../../utils/fonts';

export const styles = StyleSheet.create({
  rbsheetContainer: {
    backgroundColor: colors.paletteWhite,
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
    marginBottom: scaledValue(12),
  },
  textInputOutline: isFocused => ({
    borderWidth: isFocused ? scaledValue(1) : scaledValue(0.5),
    borderRadius: scaledValue(24),
    marginBottom: scaledValue(8),
    height: scaledValue(48),
    borderColor: colors.jetBlack,
  }),
  textInput: search => ({
    backgroundColor: 'transparent',
    paddingLeft: scaledValue(10),
    fontSize: scaledValue(16),
    lineHeight: scaledValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    opacity: search ? 0.8 : 0.6,
  }),
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
    letterSpacing: scaledValue(16 * -0.02),
  },
  optionTextSelected: {
    color: colors.jetBlack,
    fontFamily: fonts?.SATOSHI_BOLD,
    letterSpacing: scaledValue(16 * -0.02),
  },
  optionTextDefault: {
    color: colors.jetBlack,
    fontFamily: fonts?.SATOSHI_REGULAR,
    letterSpacing: scaledValue(16 * -0.02),
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
    marginBottom: scaledValue(27),
    marginTop: scaledValue(10),
  },
  btnView: {
    paddingHorizontal: scaledValue(20),
  },
});
