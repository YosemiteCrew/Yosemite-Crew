import {StyleSheet} from 'react-native';
import {colors} from '../../../../../assets/colors';
import {scaledValue} from '../../../../utils/design.utils';
import {fonts} from '../../../../utils/fonts';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.themeColor,
  },
  searchTouchable: {
    borderWidth: scaledValue(0.5),
    borderColor: colors.jetBlack,
    borderRadius: scaledValue(24),
    paddingVertical: scaledValue(14),
    paddingHorizontal: scaledValue(20),
    marginHorizontal: scaledValue(20),

    marginTop: scaledValue(24),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchText: {
    fontSize: scaledValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    opacity: 0.6,
  },
  solarWalledImage: {width: scaledValue(20), height: scaledValue(20)},
  headerTitle: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(16 * 1.2),
    marginTop: scaledValue(40),
    marginLeft: scaledValue(20),
  },
  content: {
    // marginHorizontal: scaledValue(20),
  },
  hospitalImg: {
    width: '100%',
    height: scaledValue(133),
    borderRadius: scaledValue(12),
    marginTop: scaledValue(24),
    marginBottom: scaledValue(11.6),
  },
  titleText: {
    marginBottom: scaledValue(2),
  },
  timeText: {
    fontSize: scaledValue(12),
    lineHeight: 12 * 1.2,
    color: colors.jetBlack300,
  },
  des: {
    fontSize: scaledValue(12),
    lineHeight: scaledValue(12 * 1.3),
    marginTop: scaledValue(6),
    paddingRight: scaledValue(135),
    color: colors.jetBlack300,
  },
  locationImg: {
    height: scaledValue(16),
    width: scaledValue(16),
  },
  starImg: {
    height: scaledValue(16),
    width: scaledValue(16),
  },
  locationText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(16 * 1),
  },
  ratingText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(16 * 1),
  },
  distanceView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledValue(4),
  },
  ratingView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: scaledValue(25),
    marginTop: scaledValue(-10),
  },
  bottomView: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: scaledValue(12),
  },
  iconStyle: {
    height: scaledValue(16),
    width: scaledValue(16),
    tintColor: 'white',
    marginRight: scaledValue(6.5),
  },
  bookingButton: {
    marginBottom: scaledValue(24),
  },
  getDirections: {
    backgroundColor: colors.themeColor,
    borderWidth: scaledValue(1),
  },
  directionIcon: {
    height: scaledValue(16),
    width: scaledValue(16),
    tintColor: colors.jetBlack,
    marginRight: scaledValue(6.5),
  },
  directionsText: {
    color: colors.jetBlack,
    fontSize: scaledValue(16),
  },
  bookingText: {
    fontSize: scaledValue(16),
  },
  doctorFlatlist: {
    width: '100%',

    borderRadius: scaledValue(20),
    marginTop: scaledValue(24),
    padding: scaledValue(12),

    alignSelf: 'center',

    backgroundColor: colors.paletteWhite,
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  contentView: {
    // padding: scaledValue(12),
    flexDirection: 'row',
  },

  doctorImg: {
    height: scaledValue(88),
    width: scaledValue(88),
  },
  textView: {
    paddingLeft: scaledValue(12),
  },
  bookAppointment: {
    marginHorizontal: scaledValue(12),
    marginTop: scaledValue(13),
  },
  name: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(18 * 1.2),
  },
  department: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14 * 1.2),
    color: colors.jetBlack300,
  },
  qualification: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14 * 1.2),
    color: colors.jetBlack300,
    marginBottom: scaledValue(8),
  },
  exp: {
    fontSize: scaledValue(12),
    lineHeight: scaledValue(12 * 1.2),
    color: colors.jetLightBlack,
    fontFamily: fonts.SATOSHI_BOLD,
    marginBottom: scaledValue(8),
  },
  expYears: {
    color: colors.jetBlack,
  },
  consultation: {
    // marginTop: scaledValue(8),
    fontSize: scaledValue(12),
    lineHeight: scaledValue(12 * 1.2),
    color: colors.jetLightBlack,
    fontFamily: fonts.SATOSHI_BOLD,
  },
  fees: {
    color: colors.jetBlack,
  },
});
