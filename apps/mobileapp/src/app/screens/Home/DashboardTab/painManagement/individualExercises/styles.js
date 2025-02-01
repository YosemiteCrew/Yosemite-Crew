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
  textRow: {
    flexDirection: 'row',
    marginTop: scaledValue(26),
    alignSelf: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
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
  exercisesContainer: {
    paddingHorizontal: scaledValue(20),
    marginTop: scaledValue(4),
  },
  exercisesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: scaledValue(4),
  },
  exerciseButton: {
    height: scaledValue(35),
    borderWidth: scaledValue(0.75),
    borderRadius: scaledValue(24),
    borderColor: colors.appRed,
    justifyContent: 'center',
    paddingHorizontal: scaledValue(12),
    marginTop: scaledValue(12),
    backgroundColor: '#FDBD741A',
  },
  exerciseText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.01),
    color: colors.appRed,
  },
  exerciseImage: {
    width: '100%',
    height: scaledValue(427),
  },
  headerButton: {
    marginHorizontal: scaledValue(20),
  },
});
