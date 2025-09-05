import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../../utils/design.utils';
import {fonts} from '../../../../utils/fonts';
import {colors} from '../../../../../assets/colors';
import {scan_image} from '../../../../utils/Images';

export const styles = StyleSheet.create({
  dashboardMainView: {
    // paddingHorizontal: scaledValue(20),
    flex: 1,
    backgroundColor: colors.paletteWhite,
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
    borderWidth: scaledValue(1),
    borderColor: colors.primaryBlue,
    borderRadius: scaledValue(30),
  },
  userName: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
  },
  userView: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pet: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    opacity: 0.6,

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
    // backgroundColor: '#FEF8F4',
    // paddingHorizontal: scaledValue(12),
    height: scaledValue(84),
    borderRadius: scaledValue(16),
    // marginTop: scaledValue(25),
  },
  imgStyle: {
    width: scaledValue(40),
    height: scaledValue(40),
  },
  titleStyle: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
  },
  optionView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scaledValue(8),
  },
  imgTitleView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledValue(10),
  },
  arrowImg: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  divider: {
    borderWidth: scaledValue(0.5),
    borderColor: 'rgba(55, 34, 60, 0.1)',
    marginVertical: scaledValue(4),
  },
  mapView: {
    marginTop: scaledValue(20),
    marginHorizontal: scaledValue(20),
  },
  currentTitleStyle: {
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(15.6),
    color: colors.jetBlack300,
  },
  versionView: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: scaledValue(32),
  },
  buttonText: {
    color: colors.jetBlack,
  },
  iconStyle: {
    width: scaledValue(20),
    height: scaledValue(20),
    marginRight: scaledValue(4),
  },
  buttonStyle: {
    marginTop: scaledValue(45),
    marginBottom: scaledValue(151),
    marginHorizontal: scaledValue(20),
    backgroundColor: 'transparent',
    borderColor: colors.jetBlack,
    borderWidth: scaledValue(1),
    gap: scaledValue(8),
  },
  deleteTitleStyle: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.appRed,
    marginLeft: scaledValue(10),
  },
  profileView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // marginTop: scaledValue(20),
  },
  petName: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
  },
  petBreed: {
    fontSize: scaledValue(14),
    opacity: 0.6,
    marginTop: scaledValue(4),
  },
  petGender: {
    fontSize: scaledValue(14),
    color: colors.jetBlack300,
  },
  petDetailView: {
    flexDirection: 'row',
    marginTop: scaledValue(4),
    gap: scaledValue(6.5),
  },
  qrView: {
    height: scaledHeightValue(56.54),
    width: scaledValue(57),
    borderRadius: scaledValue(10),
    borderWidth: scaledValue(1),
  },
  qrImg: {
    width: '100%',
    height: '100%',
    borderRadius: scaledValue(8),
  },
  imgView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileData: {
    marginLeft: scaledValue(10),
  },
  lineView: {
    height: scaledValue(1),
    backgroundColor: colors.jetBlack50,
    marginHorizontal: scaledValue(15),
    marginVertical: scaledValue(10),
  },
  accountsView: {
    backgroundColor: colors.themeColor,
    borderRadius: scaledValue(16),
    borderColor: colors.paletteWhite,
    shadowColor: '##47382714',
    shadowOffset: {width: 6, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
    marginHorizontal: scaledValue(20),
    padding: scaledValue(12),
    marginTop: scaledValue(20),
  },
  deleteView: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: scaledValue(20),
    gap: scaledValue(10),
    marginTop: scaledValue(8),
  },
  petImageBorder: {
    borderRadius: scaledValue(30),
    borderWidth: scaledValue(1),
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.primaryBlue,
  },
  petImage: {
    width: scaledValue(59),
    height: scaledValue(59),
    borderRadius: scaledValue(28.5),
  },
});
