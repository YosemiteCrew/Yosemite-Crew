import {StyleSheet} from 'react-native';
import {colors} from '../../../../../assets/colors';
import {scaledHeightValue, scaledValue} from '../../../../utils/design.utils';

export const styles = StyleSheet.create({
  mainContainer: {flex: 1, backgroundColor: colors.themeColor},
  topicsContainer: {
    paddingHorizontal: scaledValue(20),
  },
  topicsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: scaledValue(4),
  },
  topicButton: (selectTopic, topic) => ({
    height: scaledValue(35),
    borderWidth: scaledValue(0.75),
    borderRadius: scaledValue(24),
    borderColor: colors.appRed,
    justifyContent: 'center',
    paddingHorizontal: scaledValue(12),
    marginTop: scaledValue(12),
    backgroundColor: selectTopic === topic ? colors.appRed : '#FDBD741A',
  }),
  topicText: (selectTopic, topic) => ({
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.01),
    color: selectTopic === topic ? colors.white : colors.appRed,
  }),
  searchBar: {
    height: scaledValue(48),
    borderWidth: scaledValue(0.75),
    borderRadius: scaledValue(28),
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: scaledValue(16),
    marginHorizontal: scaledValue(20),
    marginTop: scaledValue(28),
    marginBottom: scaledValue(28),
  },
  searchTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    opacity: 0.7,
  },
  searchIcon: {
    width: scaledValue(24),
    height: scaledValue(24),
  },
  contentContainerStyle: insets => ({
    marginHorizontal: scaledValue(19),
    alignItems: 'center',
    gap: scaledValue(28),
    paddingBottom: scaledValue(77) - insets.bottom,
  }),
  featuredText: {
    marginTop: scaledValue(40),
    marginLeft: scaledValue(20),
    fontSize: scaledValue(20),
    lineHeight: scaledValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.appRed,
    marginBottom: scaledValue(12),
  },
  swipeImageView: {
    gap: 12,
    marginLeft: scaledValue(20),
    paddingRight: scaledValue(20),
  },
  petImage: {
    width: scaledValue(307),
    height: scaledValue(247),
    borderRadius: scaledValue(20),
  },
  newPuppyChecklistText: {
    marginLeft: scaledValue(18),
    fontSize: scaledValue(20),
    lineHeight: scaledValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.jetBlack,
    marginTop: scaledValue(12),
    marginBottom: scaledValue(48),
  },
  exploreTopicText: {
    marginLeft: scaledValue(20),
    fontSize: scaledValue(20),
    lineHeight: scaledValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.jetBlack,
  },
});
