import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../../utils/design.utils';
import {fonts} from '../../../../utils/fonts';
import {colors} from '../../../../../assets/colors';

export const styles = StyleSheet.create({
  dashboardMainView: {
    paddingHorizontal: scaledValue(20),
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
  userImg: {
    width: scaledValue(60),
    height: scaledValue(60),
  },
  userName: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.darkPurple,
  },
  userView: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pet: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    opacity: 0.6,
    color: colors.darkPurple,
    marginTop: scaledValue(4),
  },
  nameView: {flexDirection: 'column', marginLeft: scaledValue(10)},
  penImg: {
    width: scaledValue(32),
    height: scaledValue(32),
  },
  tileView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF8F4',
    paddingHorizontal: scaledValue(12),
    height: scaledValue(84),
    borderRadius: scaledValue(16),
    marginTop: scaledValue(25),
  },
  imgStyle: {
    width: scaledValue(40),
    height: scaledValue(40),
  },
  titleStyle: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.darkPurple,
    marginLeft: scaledValue(10),
  },
  optionView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imgTitleView: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowImg: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  divider: {
    borderWidth: scaledValue(0.5),
    borderColor: 'rgba(55, 34, 60, 0.1)',
    marginVertical: scaledValue(17),
  },
  mapView: {
    marginTop: scaledValue(32),
  },
  currentTitleStyle: {
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(15.6),
    color: colors.darkPurple,
    opacity: 0.7,
  },
  versionView: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: scaledValue(32),
  },
  buttonText: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.appRed,
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    marginLeft: scaledValue(4),
  },
  iconStyle: {
    width: scaledValue(20),
    height: scaledValue(20),
    marginRight: scaledValue(4),
  },
  buttonStyle: {
    borderWidth: scaledValue(1),
    height: scaledValue(52),
    borderRadius: scaledValue(28),
    borderColor: colors.appRed,
    marginTop: scaledValue(45),
    marginBottom: scaledValue(151),
  },
  deleteTitleStyle: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.appRed,
    marginLeft: scaledValue(10),
  },
});
