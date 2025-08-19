import {StyleSheet} from 'react-native';
import {colors} from '../../../../../../assets/colors';
import {scaledValue} from '../../../../../utils/design.utils';
import {uncheckButton} from '../../../../../utils/Images';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.themeColor,
    paddingHorizontal: scaledValue(20),
  },
  nextButton: {
    marginTop: scaledValue(30),
    marginBottom: scaledValue(20),
  },
  stepHeader: {
    color: colors.jetLightBlack,
    marginTop: scaledValue(8),
    marginBottom: scaledValue(20),
    textAlign: 'center',
    fontSize: scaledValue(12),
  },
  header: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(18 * 1.2),
    letterSpacing: scaledValue(18 * -0.01),
    marginBottom: scaledValue(10),
  },

  input: {
    width: '100%',
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    // lineHeight: scaledValue(16),
    // marginTop: scaledValue(20),
    paddingLeft: scaledValue(10),
    marginTop: scaledValue(20),
  },
  formView: {
    marginBottom: scaledValue(30),
  },
  scanIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
    marginRight: scaledValue(10),
  },
  backButton: {
    marginBottom: scaledValue(48),
    backgroundColor: colors.themeColor,
    borderWidth: scaledValue(1),
    borderColor: colors.jetBlack,
  },
  backButtonText: {
    color: colors.jetBlack,
  },
  desBox: {
    height: scaledValue(122),
    width: '100%',
    marginTop: scaledValue(20),
  },
  productUsageView: {
    height: scaledValue(48),
    borderWidth: 0.5,
    borderColor: colors.black,
    borderRadius: scaledValue(24),
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scaledValue(20),
    marginTop: scaledValue(20),
  },
  arrow: {
    height: scaledValue(20),
    width: scaledValue(20),
  },
  noOfLinesText: {
    fontSize: scaledValue(16),
  },
  checkImgView: {
    flexDirection: 'row',
  },
  uncheckButton: {
    height: scaledValue(16),
    width: scaledValue(16),
  },
  checkboxView: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(4),
    gap: scaledValue(5.88),
    marginBottom: scaledValue(-8),
  },
  checkText: {
    fontSize: scaledValue(14),
  },
  uncheckBox: {
    height: scaledValue(16),
    width: scaledValue(16),
  },
  checkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    gap: scaledValue(5),
  },
  checkBoxesView: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(4),
  },
  poundText: {
    fontSize: scaledValue(14),
  },
});
