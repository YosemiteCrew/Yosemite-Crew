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
  headerTitleText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.darkPurple,
    textAlign: 'center',
  },
  headerTitle: {
    fontSize: scaledValue(12),
    lineHeight: scaledHeightValue(12),
    color: colors.appRed,
    textAlign: 'center',
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
  buttonView: insets => ({
    width: '100%',
    paddingHorizontal: scaledValue(20),
    marginBottom: insets.bottom + scaledValue(30),
  }),
  input: {
    width: scaledValue(100),
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    padding: 0,
    height: scaledValue(32),
  },
  iconStyle: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  petImg: {
    width: scaledValue(60),
    height: scaledValue(60),
  },
  inputContainer: {
    marginTop: scaledValue(28),
    marginBottom: scaledValue(28),
    gap: scaledValue(16),
  },
  card: {
    marginTop: scaledValue(28),
    marginBottom: scaledValue(20),
    alignItems: 'center',
  },
  petHealthMainView: {
    paddingHorizontal: scaledValue(20),
    marginBottom: scaledValue(28),
  },
  petRecordTitleStyle: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
  },
  rightArrowStyle: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  optionalEntriesText: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.appRed,
    marginBottom: scaledValue(12),
  },
  bodyConditionText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
  },
  containerStyle: {
    paddingLeft: scaledValue(8),
    paddingRight: scaledValue(28),
  },
  rightIconTouchable: {
    backgroundColor: colors.appRed,
    height: scaledValue(35),
    width: scaledValue(35),
    borderRadius: scaledValue(50),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {width: scaledValue(20), height: scaledValue(20)},
  bodyConditionRightIcon: {
    backgroundColor: colors.appRed,
    height: scaledValue(35),
    width: scaledValue(35),
    borderRadius: scaledValue(50),
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyConditionTitleText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
  },
  bodyConditionContainer: {
    paddingLeft: scaledValue(8),
    paddingRight: scaledValue(28),
  },
});
