import {Dimensions, StyleSheet} from 'react-native';
import {colors} from '../../../../../../assets/colors';
import {scaledValue} from '../../../../../utils/design.utils';
import {fonts} from '../../../../../utils/fonts';
const deviceW = Dimensions.get('window').width;
export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.themeColor,
  },
  yearlySpendView: {
    height: scaledValue(192),
    marginHorizontal: scaledValue(36),
    borderRadius: scaledValue(20),
    marginTop: scaledValue(32),
    justifyContent: 'center',
    alignItems: 'center',
  },
  kiziImage: {
    height: scaledValue(64),
    width: scaledValue(64),
  },
  subHeading: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    marginTop: scaledValue(8),
    color: colors.white,
    marginBottom: scaledValue(8),
  },
  price: {
    fontSize: scaledValue(23),
    lineHeight: scaledValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.white,
  },
  addImage: {
    height: scaledValue(14),
    width: scaledValue(14),
    marginRight: scaledValue(4),
  },
  recentText: {
    fontSize: scaledValue(26),
    lineHeight: scaledValue(31.2),
    letterSpacing: scaledValue(26 * -0.01),
    color: '#302F2E',
    fontFamily: fonts.CLASH_GRO_MEDIUM,
  },
  addExpenseText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14),
    letterSpacing: scaledValue(14 * -0.01),
    color: colors.brown,
    fontFamily: fonts.CLASH_GRO_MEDIUM,
  },
  addView: {
    flexDirection: 'row',
    paddingHorizontal: scaledValue(16),
    paddingVertical: scaledValue(12),
    backgroundColor: colors.fawn,
    borderRadius: scaledValue(28),
  },
  recentView: {
    flexDirection: 'row',
    width: deviceW - 40,
    alignSelf: 'center',
    justifyContent: 'space-between',
    marginTop: scaledValue(38),
  },
  flatlistMain: {
    flexDirection: 'row',
    width: deviceW - 40,
    alignSelf: 'center',
    justifyContent: 'space-between',
    paddingVertical: scaledValue(12),
  },
  threeDots: {
    height: scaledValue(16),
    width: scaledValue(16),
  },
  priceText: {
    marginRight: scaledValue(12),
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: '#595958',
  },
  priceView: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskText: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: '#595958',
  },
  dateText: {
    color: '#595958',
    opacity: 0.7,
    fontSize: scaledValue(13),
    lineHeight: scaledValue(15.6),
    marginTop: scaledValue(4),
  },
  modalContainer: {
    backgroundColor: colors.white,
    height: scaledValue(557),
    borderRadius: scaledValue(24),

    paddingHorizontal: scaledValue(24),
    alignItems: 'center',
  },
  crossIcon: {
    height: scaledValue(22),
    width: scaledValue(22),
   
  },
  kiziImage: {
    height: scaledValue(60),
    width: scaledValue(60),
    marginTop: scaledValue(30),
  },
  addText: {
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    color: colors.appRed,
    lineHeight: scaledValue(31.2),
    letterSpacing: scaledValue(26 * -0.06),
    fontSize: scaledValue(26),
    marginTop: scaledValue(8),
    marginBottom: scaledValue(40),
  },
  expenseText: {
    color: colors.black,
  },
  input: {
    width: '100%',
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    // lineHeight: scaledValue(16),
    // marginTop: scaledValue(16),
    paddingLeft: scaledValue(10),
  },
  inputAmount: {
    width: '100%',
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    // lineHeight: scaledValue(16),
    marginTop: scaledValue(12),
    paddingLeft: scaledValue(0),
    marginBottom: scaledValue(48),
  },
  iconStyle: {
    height: scaledValue(20),
    width: scaledValue(20),
  },
  iconLeftStyle: {
    height: scaledValue(20),
    width: scaledValue(20),
  },
  categoryText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    fontFamily: fonts.SATOSHI_REGULAR,
    color: '#000000',
    opacity: 0.8,
  },
  categoryView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    alignSelf: 'center',
    borderWidth: scaledValue(0.5),
    width: '100%',
    borderRadius: scaledValue(24),
    color: '#312943',
    paddingHorizontal: scaledValue(20),
    height: scaledValue(48),
    marginTop: scaledValue(16),
  },
  expenseDateText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    fontFamily: fonts.SATOSHI_REGULAR,
    color: '#000000',
    opacity: 0.8,
  },
  calendarView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    alignSelf: 'center',
    borderWidth: scaledValue(0.5),
    width: '100%',
    borderRadius: scaledValue(24),
    color: '#312943',
    paddingHorizontal: scaledValue(20),
    height: scaledValue(48),
    marginTop: scaledValue(16),
  },
  buttonStyle: {
    height: scaledValue(52),
    paddingHorizontal: scaledValue(86),
    backgroundColor: colors.appRed,
    borderRadius: scaledValue(28),
    paddingVertical: scaledValue(16),
  },
  buttonIcon: {
    height: scaledValue(20),
    width: scaledValue(20),
    marginRight: scaledValue(8),
  },
  
});
