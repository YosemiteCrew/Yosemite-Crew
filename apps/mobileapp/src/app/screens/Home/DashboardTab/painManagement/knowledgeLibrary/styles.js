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
  scrollView: {},
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
  searchBar: {
    height: scaledValue(48),
    borderWidth: scaledValue(0.75),
    borderRadius: scaledValue(28),
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: scaledValue(16),
    marginHorizontal: scaledValue(16),
    marginTop: scaledValue(16),
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
  ongoingText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.appRed,
  },
  plansText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.darkPurple,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(24),
    paddingHorizontal: scaledValue(20),
  },
  topicsContainer: {
    paddingHorizontal: scaledValue(20),
    marginTop: scaledValue(4),
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
  popularText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    color: colors.appRed,
  },
  articleText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    color: colors.darkPurple,
  },
  titleView: {
    paddingHorizontal: scaledValue(20),
    marginTop: scaledValue(40),
    flexDirection: 'row',
  },
  petImg: {width: scaledValue(160), height: scaledValue(104)},
  pointer: {
    width: scaledValue(4),
    height: scaledValue(4),
    backgroundColor: colors.appRed,
    borderRadius: scaledValue(4),
  },
  tagText: {
    fontSize: scaledValue(10),
    lineHeight: scaledHeightValue(12),
    color: colors.darkPurple,
    letterSpacing: scaledValue(10 * -0.02),
  },
  titleText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: '#302F2E',
    opacity: 0.9,
    width: '40%',
    marginTop: scaledValue(4),
  },
  heartImg: {
    width: scaledValue(14),
    height: scaledValue(14),
  },
  likeText: {
    fontSize: scaledValue(12),
    lineHeight: scaledHeightValue(14.4),
    color: colors.darkPurple,
    opacity: 0.7,
    letterSpacing: scaledValue(12 * -0.02),
  },
  tagView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledValue(4),
    marginTop: scaledValue(8),
  },
  flatlistView: {
    paddingHorizontal: scaledValue(20),
    marginTop: scaledValue(8),
    marginBottom: scaledValue(73),
  },
});
