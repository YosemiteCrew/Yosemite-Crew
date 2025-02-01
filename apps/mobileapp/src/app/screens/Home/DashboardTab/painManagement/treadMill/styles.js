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
  headerButton: {
    marginHorizontal: scaledValue(20),
  },
  imageBackground: {
    width: scaledValue(335),
    height: scaledValue(203),
    marginTop: scaledValue(22),
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseImage: {
    width: scaledValue(48),
    height: scaledValue(47.32),
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: scaledValue(20),
    marginTop: scaledValue(22),
  },
  treadmillText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: '#302F2E',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(12),
    gap: scaledValue(4),
  },
  basicText: {
    fontSize: scaledValue(12),
    lineHeight: scaledHeightValue(14.4),
    letterSpacing: scaledValue(12 * -0.02),
    color: colors.darkPurple,
  },
  redDot: {
    width: scaledValue(4),
    height: scaledValue(4),
    backgroundColor: colors.appRed,
    borderRadius: scaledValue(10),
  },
  descriptionText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(21),
    color: '#302F2E',
    marginTop: scaledValue(37),
  },
  headingText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: '#302F2E',
    marginTop: scaledValue(24),
  },
  additionalText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(21),
    color: '#302F2E',
    marginTop: scaledValue(8),
  },
  button: {
    backgroundColor: '#FDBD74',
    height: scaledValue(48),
    borderRadius: scaledValue(28),
    bottom: scaledValue(30),
    width: '70%',
    alignSelf: 'center',
    position: 'absolute',
  },
  buttonIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
    marginRight: scaledValue(3),
  },
  buttonText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    color: colors.darkPurple,
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    marginLeft: scaledValue(3),
  },
  mainView: {marginBottom: scaledValue(100)},
});
