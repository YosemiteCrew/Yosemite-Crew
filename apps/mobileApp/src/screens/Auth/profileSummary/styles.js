import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {colors} from '../../../../assets/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.themeColor,
    paddingHorizontal: scaledValue(20),
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    // fontSize: scaledValue(23),
    // letterSpacing: scaledValue(23 * -0.01),
  },
  petProfileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(18),
    paddingHorizontal: scaledValue(20),
    justifyContent: 'center',
  },
  petImg: {
    width: scaledValue(100),
    height: scaledValue(100),
    borderRadius: scaledValue(50),
    borderWidth: scaledValue(1),
    borderColor: colors.primaryBlue,
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
    // left: scaledValue(66),
    shadowColor: '#000', // Shadow color
    shadowOffset: {width: 0, height: 2}, // Shadow offset
    shadowOpacity: 0.3, // Shadow opacity
    shadowRadius: 4, // Shadow blur radius
    elevation: 4, // Android shadow
    right: scaledValue(115),
  },
  cameraImg: {width: scaledValue(20), height: scaledValue(20)},
  petName: {
    textAlign: 'center',
    marginTop: scaledValue(8),
    fontSize: scaledValue(23),
    letterSpacing: scaledValue(23 * -0.01),
  },
  breed: {
    textAlign: 'center',
    fontSize: scaledValue(14),
    marginTop: scaledValue(2),
    opacity: 0.7,
  },
  flatListView: {marginTop: scaledValue(40)},
  tileView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaledValue(9),
  },
  summaryText: {
    fontSize: scaledValue(16),
    letterSpacing: scaledValue(16 * -0.02),
  },
  statusText: val => ({
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: val == 'pending' ? '#F89D4F' : '#54B492',
    textTransform: 'capitalize',
  }),
  arrowImg: {
    width: scaledValue(16),
    height: scaledValue(16),
    marginLeft: scaledValue(4),
  },
  divider: {
    borderWidth: scaledValue(0.5),
    borderColor: 'rgba(55, 34, 60, 0.1)',
    marginVertical: scaledValue(17),
  },
  statusView: val => ({
    height: scaledValue(25),
    borderRadius: scaledValue(28),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: val == 'pending' ? '#FEF3E9' : '#E6F4EF',
    paddingHorizontal: val == 'pending' ? scaledValue(16) : scaledValue(11),
  }),
  petImageWrapper: {
    width: scaledValue(100),
    height: scaledValue(100),
    borderRadius: scaledValue(50),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBlue,
  },
  statusMainView: {flexDirection: 'row', alignItems: 'center'},
  iconStyle: {width: scaledValue(16), height: scaledValue(16)},
  buttonStyle: {
    gap: scaledValue(6),
    marginTop: scaledValue(26),
    paddingHorizontal: scaledValue(20),
  },
  btnView: insets => ({
    marginTop: 'auto',
    marginBottom: insets + scaledValue(10),
  }),
});
