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
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.darkPurple,
  },
  petProfileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(28),
    paddingHorizontal: scaledValue(20),
    justifyContent: 'center',
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
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.darkPurple,
  },
  breed: {
    textAlign: 'center',
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    marginTop: scaledValue(2),
  },
  flatListView: {marginTop: scaledValue(56)},
  tileView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaledValue(9),
  },
  summaryText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
    color: colors.darkPurple,
  },
  statusText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: '#ffffff',
  },
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
  statusView: {
    height: scaledValue(25),
    borderRadius: scaledValue(28),
    justifyContent: 'center',
    alignItems: 'center',
  },
});
