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
    paddingHorizontal: scaledValue(20),
  },
  scrollView: {
    flex: 1,
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
  ongoingText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.appRed,
  },
  plansText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.darkPurple,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(50),
  },
  petTitle: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
    color: colors.darkPurple,
    marginTop: scaledValue(4),
  },
  imgStyle: {
    width: scaledValue(80),
    height: scaledValue(80),
  },
  petItem: {
    alignItems: 'center',
  },
  petListContainer: {
    flexDirection: 'row',
    marginTop: scaledValue(16),
    gap: scaledValue(12),
  },
  buttonView: {marginTop: scaledValue(4)},
  buttonText: {
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.appRed,
  },
  buttonStyle: (selectButton, i) => ({
    borderWidth: scaledValue(1),
    borderColor: colors.appRed,
    height: scaledValue(52),
    borderRadius: scaledValue(28),
    marginTop: scaledValue(12),
    opacity: selectButton?.id === i?.id ? 0.5 : 1,
  }),
  filledButtonText: {
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.brown,
  },
  filledButtonStyle: insets => ({
    height: scaledValue(52),
    borderRadius: scaledValue(28),
    marginTop: scaledValue(12),
    backgroundColor: '#FDBD74',
    position: 'absolute',
    bottom: insets.bottom + scaledValue(30),
    width: '100%',
    alignSelf: 'center',
  }),
});
