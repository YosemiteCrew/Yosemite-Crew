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
  headerTitle: {
    fontSize: scaledValue(12),
    lineHeight: scaledHeightValue(12),
    color: colors.appRed,
    textAlign: 'center',
  },
  teamText: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    color: colors.darkPurple,
    letterSpacing: scaledValue(20 * -0.01),
  },
  countText: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    color: '#37223C80',
    letterSpacing: scaledValue(20 * -0.01),
  },
  doctorImg: {
    width: scaledValue(88),
    height: scaledValue(88),
    borderRadius: scaledValue(12),
  },
  card: {
    backgroundColor: '#FFF6EB',
    width: scaledValue(335),
    borderRadius: scaledValue(20),
    shadowColor: '#47382726',
    shadowOffset: {width: 1, height: 5},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  doctorName: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    color: '#090A0A',
    letterSpacing: scaledValue(18 * -0.01),
  },
  departmentText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.7),
    color: colors.darkPurple,
    opacity: 0.7,
    marginTop: scaledValue(2),
  },
  experienceText: {
    fontSize: scaledValue(12),
    lineHeight: scaledHeightValue(14.4),
    color: colors.darkPurple,
  },
  experienceTextStyle: {
    fontSize: scaledValue(12),
    lineHeight: scaledHeightValue(14.4),
    color: colors.appRed,
  },
  buttonTextStyle: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16),
    color: colors.appRed,
    marginLeft: scaledValue(2),
    letterSpacing: scaledValue(14 * -0.01),
    fontFamily: fonts.CLASH_GRO_MEDIUM,
  },
  buttonStyle: {
    borderWidth: scaledValue(1),
    borderColor: colors.appRed,
    marginTop: scaledValue(20),
    borderRadius: scaledValue(28),
    height: scaledValue(44),
    marginBottom: scaledValue(16),
    marginHorizontal: scaledValue(12),
    backgroundColor: 'transparent',
  },
  iconStyle: {
    width: scaledValue(16),
    height: scaledValue(16),
    marginRight: scaledValue(2),
  },
  headerView: {
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(48),
  },
  cardView: {
    paddingHorizontal: scaledValue(20),
  },
  cardInnerView: {
    flexDirection: 'row',
    paddingTop: scaledValue(12),
    paddingLeft: scaledValue(12),
  },
  doctorImgView: {flexDirection: 'column', alignItems: 'center'},
  starImgView: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(5),
  },
  starImg: {width: scaledValue(16), height: scaledValue(16)},
  experienceView: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(8),
  },
  feesView: {flexDirection: 'row', marginTop: scaledValue(8)},
});
