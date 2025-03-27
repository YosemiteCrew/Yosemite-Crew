import {StyleSheet} from 'react-native';
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
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.darkPurple,
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
  },
  infoView: {marginLeft: scaledValue(8), gap: scaledValue(4)},
  petName: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.darkPurple,
  },
  breed: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
  },
  otherInfoView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledValue(8),
  },
  gender: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
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
    backgroundColor: 'red',
    borderRadius: scaledValue(8),
  },
  remainingBar: {
    height: '100%',
    backgroundColor: '#aaa',
    right: scaledValue(2),
    borderRadius: scaledValue(8),
  },
  iconStyle: {width: scaledValue(16), height: scaledValue(16)},
  buttonStyle: {
    backgroundColor: '#FDBD74',
    // height: scaledValue(52),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: scaledValue(40),
    marginBottom: scaledValue(40),
    position: 'absolute',
    bottom: scaledValue(85),
    padding: scaledValue(15),
    paddingVertical: scaledValue(15),
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
    color: colors.appRed,
    lineHeight: scaledHeightValue(16.8),
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
    marginTop: scaledValue(20),
    justifyContent: 'space-between',
  },
});
