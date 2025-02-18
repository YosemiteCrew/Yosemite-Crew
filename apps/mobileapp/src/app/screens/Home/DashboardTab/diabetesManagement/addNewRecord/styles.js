import {StyleSheet} from 'react-native';
import {colors} from '../../../../../../assets/colors';
import {
  scaledHeightValue,
  scaledValue,
} from '../../../../../utils/design.utils';
import {fonts} from '../../../../../utils/fonts';

export const styles = StyleSheet.create({
  dashboardMainView: {
    flex: 1,
    backgroundColor: colors.themeColor,
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
    marginTop: scaledValue(40),
  },
  petListContainer: {
    marginTop: scaledValue(16),
    marginBottom: scaledValue(60),
  },
  petList: {
    gap: scaledValue(16),
  },
  petItem: {},
  petImage: {
    width: scaledValue(80),
    height: scaledValue(80),
  },
  petNameText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    marginTop: scaledValue(4),
    letterSpacing: scaledValue(16 * -0.02),
    color: colors.darkPurple,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    // lineHeight: scaledValue(16),
    marginTop: scaledValue(40),
    paddingLeft: scaledValue(10),
  },
  buttonText: {
    fontSize: scaledValue(18),
    // lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.brown,
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
  },
  buttonStyle: {
    backgroundColor: '#FDBD74',
    marginTop: scaledValue(40),
    height: scaledValue(52),
    borderRadius: scaledValue(28),
  },
  container: {paddingHorizontal: scaledValue(20)},
  iconStyle: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  buttonView: insets => ({
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: scaledValue(20),
    marginBottom: insets.bottom + scaledValue(30),
  }),

  recordDateText: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.16),
    letterSpacing: scaledValue(18 * -0.01),
  },
  labelTextStyle: {
    color: colors.appRed,
    fontSize: scaledValue(17),
    lineHeight: scaledValue(22),
    fontFamily: fonts.SF_PRO_TEXT_REGULAR,
  },
});
