import {StyleSheet} from 'react-native';
import {
  scaledHeightValue,
  scaledValue,
} from '../../../../../utils/design.utils';
import {colors} from '../../../../../../assets/colors';

export const styles = StyleSheet.create({
  dashboardMainView: {
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
  headerButton: {
    marginHorizontal: scaledValue(20),
  },
  text: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    opacity: 0.6,
    color: colors.darkPurple,
  },
  innerView: {
    paddingHorizontal: scaledValue(20),
    marginTop: scaledValue(30),
  },
  exerciseContainer: {
    flexDirection: 'row',
    marginTop: scaledValue(16),
  },
  videoThumbnail: {
    width: scaledValue(132),
    height: scaledValue(80),
  },
  exerciseDetails: {
    marginLeft: scaledValue(8),
    marginTop: scaledValue(8),
  },
  exerciseTitle: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
  },
  exerciseStatus: {
    fontSize: scaledValue(12),
    lineHeight: scaledHeightValue(14.4),
    letterSpacing: scaledValue(12 * -0.02),
    marginTop: scaledValue(4),
    opacity: 0.7,
  },
  likeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(8),
  },
  heartIcon: {
    width: scaledValue(14),
    height: scaledValue(14),
  },
  likeText: {
    fontSize: scaledValue(12),
    lineHeight: scaledHeightValue(14.4),
    letterSpacing: scaledValue(12 * -0.02),
    opacity: 0.6,
  },
});
