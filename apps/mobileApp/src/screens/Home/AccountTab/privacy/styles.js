import {StyleSheet} from 'react-native';
import {colors} from '../../../../../assets/colors';
import {scaledValue} from '../../../../utils/design.utils';
import {fonts} from '../../../../utils/fonts';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  sectionHeader: {
    // marginTop: 20,
    marginBottom: 10,
    color: colors.jetBlack,
  },
  heading: {
    fontSize: scaledValue(14),
    fontFamily: fonts.SATOSHI_BOLD,
    color: colors.jetBlack,
    marginTop: scaledValue(20),
  },

  itemContainer: {
    marginBottom: 10,
  },
  subItem: {
    marginBottom: 10,
    color: colors.jetBlack,
  },
  item: {
    fontSize: 14,
    color: colors.jetBlack,
    lineHeight: scaledValue(14 * 1.2),
    marginTop: scaledValue(20),
  },
  pointNumber: {
    fontFamily: fonts.SATOSHI_BOLD,
  },

  bulletList: {
    marginTop: 6,
    paddingLeft: 16,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bulletDot: {
    fontSize: 14,
    marginRight: 6,
    lineHeight: 20,
  },
  bulletText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14 * 1.2),
    color: colors.jetBlack,
  },
  header: {
    fontSize: scaledValue(23),
    lineHeight: scaledValue(23 * 1.2),
    textAlign: 'center',
    color: colors.jetBlack,
  },
  headerText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14 * 1.2),
    marginTop: scaledValue(15),
    textAlign: 'center',
  },
  updationText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14 * 1.2),
    marginBottom: scaledValue(40),
  },
  description: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14 * 1.2),
    color: colors.jetBlack,
    marginTop: scaledValue(20),
  },
  labelDescription: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14 * 1.2),
    color: colors.jetBlack,
  },
  paraText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14 * 1.2),
    color: colors.jetBlack,
    fontFamily: fonts.SATOSHI_REGULAR,
  },
  paraHeading: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(14 * 1.2),
    color: colors.jetBlack,

    fontFamily: fonts.SATOSHI_BOLD,
  },
  subSectionHeading: {
    fontSize: 14,
    lineHeight: scaledValue(14 * 1.2),
    color: colors.jetBlack,

    marginVertical: scaledValue(20),
  },
  pointText: {
    fontSize: 14,
    lineHeight: scaledValue(14 * 1.2),
    color: colors.jetBlack,
  },
  paragraphItem: {
    flexDirection: 'row',
    marginVertical: scaledValue(22),
    color: colors.jetBlack,
  },
});

export default styles;
