import {Dimensions, StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {fonts} from '../../../utils/fonts';
import {colors} from '../../../../assets/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.themeColor,
    paddingHorizontal: scaledValue(20),
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
  },
  backButtonImage: {
    width: scaledValue(28),
    height: scaledValue(28),
  },
  headerTextContainer: {
    flexDirection: 'row',
  },
  headerText: {
    fontSize: scaledValue(23),
    letterSpacing: scaledValue(23 * -0.01),
  },
  headerTextHighlighted: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    left: scaledValue(2),
    color: colors.appRed,
  },
  petProfileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  petImg: {
    width: scaledValue(100),
    height: scaledValue(100),
    borderRadius: scaledValue(50),
    borderWidth: scaledValue(2),
    borderColor: colors.primaryBlue,
  },
  infoView: {marginLeft: scaledValue(12), gap: scaledValue(4)},
  petName: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
  },
  breed: {
    fontSize: scaledValue(14),
    color: colors.jetBlack300,
  },
  otherInfoView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledValue(8),
  },
  gender: {
    fontSize: scaledValue(14),
    textTransform: 'capitalize',
    color: colors.jetBlack300,
  },
  pointer: {
    width: scaledValue(4),
    height: scaledValue(4),
    backgroundColor: colors.appRed,
    borderRadius: scaledValue(4),
  },
  progressBarContainer: {
    width: scaledValue(142),
    height: scaledValue(2),
    flexDirection: 'row',
    borderRadius: scaledValue(8),
  },
  filledBar: {
    height: '100%',
    backgroundColor: colors.primaryBlue,
    borderRadius: scaledValue(8),
  },
  remainingBar: {
    height: '100%',
    backgroundColor: '#BBD6F9',
    right: scaledValue(2),
    borderRadius: scaledValue(8),
  },
  iconStyle: {width: scaledValue(16), height: scaledValue(16)},
  buttonStyle: {
    gap: scaledValue(6),
    marginTop: scaledValue(26),
    paddingHorizontal: scaledValue(20),
  },
  buttonText: {
    fontSize: scaledValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    marginLeft: scaledValue(6),
    color: colors.brown,
  },
  percentageText: {
    fontSize: scaledValue(14),
  },
  threeDot: {width: scaledValue(20), height: scaledValue(20)},
  hitSlop: {
    top: 20,
    bottom: 20,
    left: 20,
    right: 20,
  },

  petProfileMainContainer: {
    flexDirection: 'row',
    // marginTop: scaledValue(20),
    justifyContent: 'space-between',
  },
  optionsWrapper: {
    paddingVertical: scaledValue(20),
    alignSelf: 'center',
    // gap: scaledValue(16),
  },
  optionsContainer: {
    borderRadius: scaledValue(24),
    marginTop: scaledValue(25),
    width: 'auto',
    paddingHorizontal: scaledValue(19),
  },
  editImg: {
    width: scaledValue(14),
    height: scaledValue(14),
  },
  editText: {
    fontSize: scaledValue(14),
    letterSpacing: scaledValue(14 * -0.01),
  },
  emptyView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Dimensions.get('window').height / 4.5,
  },
  noPetImage: {width: scaledValue(156), height: scaledValue(99.88)},
  emptyTitle: {
    marginTop: scaledValue(22),
    fontSize: scaledValue(20),
    letterSpacing: scaledValue(20 * -0.01),
  },
  emptyDescription: {
    textAlign: 'center',
    paddingHorizontal: scaledValue(70),
    marginTop: scaledValue(9),
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14 * 1.2),
  },
  containerStyle: {
    paddingBottom: Dimensions.get('window').height / 3,
    gap: scaledValue(20),
    marginTop: scaledValue(20),
  },
  petImageWrapper: {
    width: scaledValue(100),
    height: scaledValue(100),
    borderRadius: scaledValue(50),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBlue,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledValue(4),
    borderWidth: scaledValue(1),
    borderColor: colors.jetBlack,
    paddingVertical: scaledValue(12),
    borderRadius: scaledValue(28),
    paddingHorizontal: scaledValue(19),
  },
  menuDivider: {
    borderWidth: scaledValue(1),
    width: scaledValue(136),
    borderColor: '#EAEAEA',
    marginVertical: scaledValue(8),
  },
  btnView: insets => ({
    marginTop: 'auto',
    marginBottom: insets + scaledValue(105),
  }),
  contentStyle: {
    paddingBottom: Dimensions.get('window').height / 3,
    gap: scaledValue(20),
    marginTop: scaledValue(20),
  },
  dotView: {
    width: scaledValue(50),
    height: scaledValue(25),
    alignItems: 'center',
  },
  menuView: {position: 'absolute', right: -10},
  headerLeftBtn: {marginLeft: scaledValue(20)},
});
