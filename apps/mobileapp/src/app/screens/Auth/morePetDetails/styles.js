import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {fonts} from '../../../utils/fonts';
import {colors} from '../../../../assets/colors';
export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.themeColor,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: scaledValue(20),
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
    marginTop: scaledValue(41),
    paddingHorizontal: scaledValue(20),
  },
  petImg: {
    width: scaledValue(100),
    height: scaledValue(100),
    top: -5,
  },
  cameraView: {
    width: scaledValue(32),
    height: scaledValue(32),
    backgroundColor: colors.themeColor,
    borderRadius: scaledValue(50),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 5,
    left: scaledValue(66),
    shadowColor: '#000', // Shadow color
    shadowOffset: {width: 0, height: 2}, // Shadow offset
    shadowOpacity: 0.3, // Shadow opacity
    shadowRadius: 4, // Shadow blur radius
    elevation: 4, // Android shadow
  },
  cameraImg: {width: scaledValue(20), height: scaledValue(20)},
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
  inputView: {
    marginTop: scaledValue(13),
    paddingHorizontal: scaledValue(20),
  },
  inputStyle: {
    width: '100%',
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    // lineHeight: scaledValue(16),
    marginTop: scaledValue(16),
    paddingLeft: scaledValue(10),
  },
  insuredView: {
    marginTop: scaledValue(16),
    flexDirection: 'row',
    gap: scaledValue(8),
  },
  linear: {borderRadius: scaledValue(28)},
  tile: {
    borderRadius: scaledValue(28),
    height: scaledValue(48),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scaledValue(25),
  },
  insuredText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
  },
  companyTile: {
    borderWidth: scaledValue(0.5),
    height: scaledValue(48),
    marginTop: scaledValue(16),
    borderRadius: scaledValue(24),
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderColor: '#312943',
  },
  companyText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    color: '#312943',
  },
  titleText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
    marginTop: scaledValue(16),
    paddingHorizontal: scaledValue(20),
  },
  flatListView: {paddingHorizontal: scaledValue(12)},
  linearView: {
    borderRadius: scaledValue(28),
    marginTop: scaledValue(12),
    marginHorizontal: scaledValue(4),
  },
  placeView: {
    borderRadius: scaledValue(28),
    height: scaledValue(40),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scaledValue(20),
  },
  placeText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
  },
  textButton: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.appRed,
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    textAlign: 'center',
    marginTop: scaledValue(40),
  },
  buttonStyle: {
    backgroundColor: '#FDBD74',
    width: '90%',
    height: scaledValue(52),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: scaledValue(48),
    marginTop: scaledValue(17),
  },
  buttonText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(16 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    color: colors.brown,
  },
});
