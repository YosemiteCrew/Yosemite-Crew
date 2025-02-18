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
    paddingHorizontal: scaledValue(20),
  },
  headerRow: {
    flexDirection: 'row',
    marginTop: scaledValue(38),
  },
  ongoingText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.appRed,
  },
  plansText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.darkPurple,
    textTransform: 'lowercase',
  },
  buttonText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    color: colors.brown,
    marginLeft: scaledValue(3),
    top: scaledValue(2),
  },
  buttonIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
    marginRight: scaledValue(3),
  },
  button: insets => ({
    height: scaledValue(48),
    width: scaledValue(198),
    alignSelf: 'center',
    backgroundColor: '#FDBD74',
    borderRadius: scaledValue(28),
    position: 'absolute',
    bottom: 0,
    marginBottom: insets.bottom + scaledValue(34),
  }),
  invoiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF6EB',
    height: scaledValue(88),
    borderRadius: scaledValue(16),
    shadowColor: '#47382726',
    shadowOffset: {width: 1, height: 5},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    paddingHorizontal: scaledValue(16),
  },
  titleText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    color: colors.darkPurple,
  },
  dateText: {
    fontSize: scaledValue(12),
    lineHeight: scaledHeightValue(14.4),
    color: colors.darkPurple,
    opacity: 0.5,
    letterSpacing: scaledValue(12 * -0.02),
    marginTop: scaledValue(2),
  },
  image: {
    width: scaledValue(36),
    height: scaledValue(36),
  },
  attachmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(5),
  },
  attachmentImage: {
    width: scaledValue(14),
    height: scaledValue(14),
  },
});
