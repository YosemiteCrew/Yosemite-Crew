import {StyleSheet} from 'react-native';
import {scaledValue} from '../../../../utils/design.utils';
import {fonts} from '../../../../utils/fonts';
import {colors} from '../../../../../assets/colors';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: scaledValue(20),
  },
  sectionHeader: {
    marginTop: 20,
    // marginBottom: 10,
  },
  heading: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#555',
  },
  subSectionHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 4,
  },
  itemContainer: {
    marginBottom: 10,
  },
  subItem: {
    marginBottom: 0,
  },
  item: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  pointNumber: {
    fontWeight: 'bold',
  },
  pointLabel: {
    fontWeight: 'bold',
  },
  pointText: {
    fontWeight: 'normal',
  },
  bulletList: {
    marginTop: 6,
    paddingLeft: 16,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bulletDot: {
    fontSize: 14,
    marginRight: 6,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#444',
  },
  addendumText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14 * 1.2),
    marginBottom: scaledValue(30),
  },
  withdrawalText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14 * 1.2),
  },
  rightOfWithdrawalPara: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14 * 1.2),
  },
  withdrawalFormHeader: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14 * 1.2),
    marginTop: scaledValue(60),
  },
  withdrawalformSubHeader: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14 * 1.2),
    marginBottom: scaledValue(26),
  },
  input: {
    width: '100%',
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    paddingLeft: scaledValue(10),
    marginBottom: scaledValue(16),
  },
  desBox: {
    height: scaledValue(122),
    width: '100%',
  },
  checkButtonText: {
    fontSize: scaledValue(14),
    lineHeight: 14 * 1.2,
  },
  uncheckButton: {
    height: scaledValue(20),
    width: scaledValue(20),
  },
  checkButtonView: {
    flexDirection: 'row',
    gap: scaledValue(10),
    marginTop: scaledValue(24),
    marginBottom: scaledValue(24),
  },
  formSubmissionDetails: {
    fontFamily: fonts.SATOSHI_REGULAR,
    color: colors.jetLightBlack,
    lineHeight: scaledValue(14 * 1.2),
    fontSize: scaledValue(14),
    textAlign: 'center',
    marginTop: scaledValue(20),
    marginBottom: scaledValue(64),
  },
  address: {
    fontFamily: fonts.SATOSHI_BOLD,
  },
  title: {
    fontSize: scaledValue(23),
    lineHeight: scaledValue(23 * 1.2),
    letterSpacing: scaledValue(23 * -0.01),
    textAlign: 'center',
  },
});

export default styles;
