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
  optionContainer: {
    flexDirection: 'row',
    gap: scaledValue(4),
    paddingLeft: scaledValue(20),
  },
  optionButton: {
    height: scaledValue(35),
    borderRadius: scaledValue(24),
    justifyContent: 'center',
    paddingHorizontal: scaledValue(16),
    borderColor: colors.appRed,
  },
  optionText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    letterSpacing: scaledValue(16 * -0.01),
  },
  scrollView: {
    marginTop: scaledValue(10),
  },
  flatListContainer: {
    gap: scaledValue(12),
    paddingBottom: scaledValue(57),
    paddingTop: scaledValue(28),
    paddingHorizontal: scaledValue(12),
  },
  listTile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFF6EB',
    paddingHorizontal: scaledValue(12),
    paddingVertical: scaledValue(16),
    borderRadius: scaledValue(16),
    shadowColor: '#47382726',
    shadowOffset: {width: 10, height: 10},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 10,
  },
  imgTextView: {flexDirection: 'row'},
  messageImg: {width: scaledValue(40), height: scaledValue(40)},
  innerTextView: {marginLeft: scaledValue(8)},
  titleStyle: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    color: colors.darkPurple,
  },
  messageText: {
    fontSize: scaledValue(12),
    lineHeight: scaledHeightValue(15.6),
    color: colors.darkPurple,
    marginTop: scaledValue(6),
    opacity: 0.7,
    width: scaledValue(230),
  },
  petImg: {width: scaledValue(24), height: scaledValue(24)},
  timeText: {
    fontSize: scaledValue(11),
    lineHeight: scaledHeightValue(13.2),
    color: colors.black,
    marginTop: scaledValue(2),
    opacity: 0.4,
  },
});
