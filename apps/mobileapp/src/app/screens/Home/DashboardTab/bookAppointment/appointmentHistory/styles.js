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
  optionContainer: {
    flexDirection: 'row',
    gap: scaledValue(4),
    paddingLeft: scaledValue(20),
  },
  scrollView: {
    marginTop: scaledValue(20),
  },
  optionButton: {
    height: scaledValue(35),
    borderRadius: scaledValue(24),
    justifyContent: 'center',
    paddingHorizontal: scaledValue(14),
    borderColor: colors.appRed,
  },
  optionText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    letterSpacing: scaledValue(16 * -0.01),
  },
  headerView: {
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(32),
  },
  teamText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    color: colors.darkPurple,
    letterSpacing: scaledValue(18 * -0.01),
  },
  countText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    color: colors.appRed,
    letterSpacing: scaledValue(18 * -0.01),
  },
  doctorImgStyle: {
    width: scaledValue(88),
    height: scaledValue(88),
  },
  swiperCard: {
    width: scaledValue(335),
    backgroundColor: colors.appRed,
    alignSelf: 'center',
    borderRadius: scaledValue(20),
    marginTop: scaledValue(12),
    shadowColor: '#47382726',
    shadowOffset: {width: 1, height: 5},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  cardInnerView: {
    flexDirection: 'row',
    marginTop: scaledValue(16),
    paddingLeft: scaledValue(12),
    paddingBottom: scaledValue(16),
  },
  doctorNameText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    color: colors.white,
    letterSpacing: scaledValue(18 * -0.01),
    width: '85%',
  },
  departmentText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.white,
    marginTop: scaledValue(2),
    opacity: 0.7,
    width: '85%',
  },
  infoView: {
    marginLeft: scaledValue(8),
  },
  buttonText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.white,
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    marginLeft: scaledValue(3),
  },
  buttonStyle: {
    backgroundColor: '#FFFEFE4D',
    marginBottom: scaledValue(16),
    height: scaledValue(51),
    borderRadius: scaledValue(12),
    marginHorizontal: scaledValue(12),
    alignItems: 'center',
  },
  iconStyle: {
    width: scaledValue(16),
    height: scaledValue(16),
    marginRight: scaledValue(3),
  },
  buttonView: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaledValue(12),
    gap: scaledValue(8),
    width: scaledValue(176),
    marginBottom: scaledValue(8),
  },
  buttonDirectionStyle: {
    backgroundColor: 'transparent',
    height: scaledValue(47),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    borderWidth: scaledValue(1),
    borderColor: colors.white,
    width: '100%',
  },
  buttonChatStyle: {
    backgroundColor: colors.white,
    height: scaledValue(47),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    width: '100%',
  },
  dotStyle: {
    width: scaledValue(10),
    height: scaledValue(10),
    borderRadius: scaledValue(20),
    opacity: 0.4,
  },
  activeDotStyle: {
    width: scaledValue(10),
    height: scaledValue(10),
    borderRadius: scaledValue(20),
  },
  customButton: {
    height: scaledValue(48),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: scaledValue(1),
    borderColor: colors.appRed,
    borderRadius: scaledValue(12),
    paddingHorizontal: scaledValue(20),
    marginHorizontal: scaledValue(12),
  },
  arrowStyle: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
});
