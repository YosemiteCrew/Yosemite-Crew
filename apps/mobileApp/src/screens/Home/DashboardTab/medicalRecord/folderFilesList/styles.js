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
    paddingHorizontal: scaledValue(20),
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: scaledValue(50),
    paddingHorizontal: scaledValue(30),
  },
  emptyImage: {
    width: scaledValue(220),
    height: scaledValue(235),
    resizeMode: 'contain',
  },
  emptyTitle: {
    textAlign: 'center',
    fontSize: scaledValue(20),
    marginTop: scaledValue(16),
    letterSpacing: scaledValue(-0.2),
  },
  emptySubtitle: {
    textAlign: 'center',
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16),
    marginTop: scaledValue(10),
  },
  dotView: {
    width: scaledValue(50),
    height: scaledValue(25),
    alignItems: 'center',
  },
  threeDot: {width: scaledValue(20), height: scaledValue(20)},
  editImg: {
    width: scaledValue(14),
    height: scaledValue(14),
    tintColor: colors.jetBlack,
  },
  optionsContainer: {
    borderRadius: scaledValue(24),
    marginTop: scaledValue(25),
    width: 'auto',
    paddingHorizontal: scaledValue(19),
  },
  optionsWrapper: {
    paddingVertical: scaledValue(20),
    alignSelf: 'center',
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledValue(4),
    borderWidth: scaledValue(1),
    borderColor: colors.jetBlack,
    paddingVertical: scaledValue(12),
    borderRadius: scaledValue(28),
    paddingHorizontal: scaledValue(15),
    justifyContent: 'center',
  },
  menuDivider: {
    borderWidth: scaledValue(1),
    width: scaledValue(153),
    borderColor: '#EAEAEA',
    marginVertical: scaledValue(8),
  },
  editText: {
    fontSize: scaledValue(14),
    letterSpacing: scaledValue(14 * -0.01),
    textAlign: 'center',
  },
  recordItemContainer: {
    borderWidth: scaledValue(1),
    borderRadius: scaledValue(20),
    paddingHorizontal: scaledValue(12),
    paddingVertical: scaledValue(15),
    borderColor: colors.jetBlack50,
    shadowColor: '##47382714',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 1,
    backgroundColor: colors.themeColor,
    shadowOffset: {width: -0, height: -0.5},
  },
  recordHeader: {
    flexDirection: 'row',
  },
  doctorImage: {
    width: scaledValue(88),
    height: scaledValue(88),
    borderRadius: scaledValue(12),
  },
  recordTextSection: {
    marginLeft: scaledValue(8),
    width: '60%',
  },
  doctorName: {
    fontSize: scaledValue(18),
    color: colors.richBlack,
    letterSpacing: scaledValue(18 * -0.01),
  },
  subText: {
    fontSize: scaledValue(14),
    opacity: 0.7,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.jetBlack50,
    marginTop: scaledValue(12),
    paddingVertical: scaledValue(16),
    borderRadius: scaledValue(12),
    justifyContent: 'center',
    gap: scaledValue(6),
    marginBottom: scaledValue(17),
  },
  dateIcon: {
    width: scaledValue(16),
    height: scaledValue(16),
  },
  dateText: {
    fontSize: scaledValue(16),
    letterSpacing: scaledValue(16 * -0.01),
  },
  recordFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: scaledValue(12),
  },
  recordName: {
    fontSize: scaledValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.richBlack,
  },
  kiziIconContainer: {
    borderWidth: scaledValue(1),
    width: scaledValue(32),
    height: scaledValue(32),
    borderRadius: scaledValue(16),
    borderColor: colors.primaryBlue,
    right: scaledValue(4),
  },
  kiziIcon: {
    width: scaledValue(32),
    height: scaledValue(32),
    borderRadius: scaledValue(16),
    borderWidth: scaledValue(0.75),
    borderColor: colors.primaryBlue,
    right: scaledValue(4),
  },
  recordFrame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#fff',
  },
  container: {
    position: 'relative',
    borderRadius: scaledValue(1.6),
    overflow: 'hidden',
    marginTop: scaledValue(12),
  },
  fileListContentContainer: {
    gap: scaledValue(16),
    marginBottom: 10,
    backgroundColor: colors.paletteWhite,
    marginTop: scaledValue(20),
  },
});
