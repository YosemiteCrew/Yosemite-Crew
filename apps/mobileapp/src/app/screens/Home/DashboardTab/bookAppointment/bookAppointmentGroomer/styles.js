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
  addressView: {
    flexDirection: 'row',
    marginTop: scaledValue(12),
  },
  addressText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    color: colors.darkPurple,
    opacity: 0.7,
    marginLeft: scaledValue(8),
    width: '90%',
  },
  buttonTextStyle: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(16),
    color: colors.appRed,
    marginLeft: scaledValue(2),
    letterSpacing: scaledValue(16 * -0.01),
    fontFamily: fonts.CLASH_GRO_MEDIUM,
  },
  buttonStyle: {
    borderWidth: scaledValue(1),
    borderColor: colors.appRed,
    marginTop: scaledValue(20),
    borderRadius: scaledValue(28),
    height: scaledValue(44),
  },
  iconStyle: {
    width: scaledValue(14),
    height: scaledValue(14),
    marginRight: scaledValue(2),
  },
  headerView: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(40),
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
  circleImg: {
    width: scaledValue(16),
    height: scaledValue(16),
  },
  serviceText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    opacity: 0.8,
    marginLeft: scaledValue(8),
  },
  serviceView: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceContainer: {
    marginTop: scaledValue(16),
    gap: scaledValue(12),
    marginBottom: scaledValue(100),
  },
  cardView: {
    marginTop: scaledValue(64),
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
  doctorImg: {
    width: scaledValue(88),
    height: scaledValue(88),
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
  },
  iconStyle: {
    width: scaledValue(16),
    height: scaledValue(16),
    marginRight: scaledValue(2),
  },
  scrollView: {
    paddingHorizontal: scaledValue(20),
    marginTop: scaledValue(10),
  },
  tenderImage: {
    width: scaledValue(335),
    height: scaledValue(207.52),
  },
  titleText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: '#090A0A',
    marginTop: scaledValue(12),
  },
  subtitleText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    marginTop: scaledValue(2),
    opacity: 0.7,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(10),
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: scaledValue(12),
  },
  iconImage: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  distanceText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(18),
    color: '#090A0A',
    marginLeft: scaledValue(4),
  },
  ratingText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(18),
    color: '#090A0A',
    marginLeft: scaledValue(4),
  },
  doctorDetails: {
    marginLeft: scaledValue(8),
  },
  serviceTextStyle: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    color: colors.appRed,
    marginTop: scaledValue(40),
    letterSpacing: scaledValue(18 * -0.01),
  },
});
