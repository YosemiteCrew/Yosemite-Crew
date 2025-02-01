import {StyleSheet} from 'react-native';
import {scaledValue} from '../../../../../utils/design.utils';
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
  container: {
    paddingHorizontal: scaledValue(20),
  },
  listItem: {
    marginTop: scaledValue(32),
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
  },
  petImage: {
    width: scaledValue(40),
    height: scaledValue(40),
  },
  nameContainer: {
    marginLeft: scaledValue(8),
  },
  petNameText: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.appRed,
  },
  journalText: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.darkPurple,
  },
  dateText: {
    fontSize: scaledValue(12),
    lineHeight: scaledValue(14.4),
    letterSpacing: scaledValue(12 * -0.01),
    opacity: 0.6,
  },
  addNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  addNewImage: {
    width: scaledValue(14),
    height: scaledValue(14),
    marginRight: scaledValue(2),
  },
  addNewText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14),
    letterSpacing: scaledValue(14 * -0.01),
    marginLeft: scaledValue(2),
    color: colors.appRed,
  },
  mainImage: {
    width: scaledValue(334),
    height: scaledValue(200),
    marginTop: scaledValue(12),
  },
});
