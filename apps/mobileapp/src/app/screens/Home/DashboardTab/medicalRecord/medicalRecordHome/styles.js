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
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: scaledValue(18),
    paddingHorizontal: scaledValue(16),
    marginHorizontal: scaledValue(16),
    borderWidth: scaledValue(0.75),
    borderColor: colors.darkPurple,
    height: scaledValue(48),
    borderRadius: scaledValue(28),
  },
  searchBarText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    opacity: 0.7,
    color: colors.darkPurple,
  },
  searchBarIcon: {
    width: scaledValue(24),
    height: scaledValue(24),
  },
  fileListContainer: {
    marginTop: scaledValue(20),
    paddingHorizontal: scaledValue(20),
  },
  fileListContentContainer: {
    gap: scaledValue(16),
  },
  fileItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: scaledValue(73),
    backgroundColor: '#FFF6EB',
    shadowColor: '#47382726',
    shadowOffset: {width: 1, height: 5},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    borderRadius: scaledValue(16),
  },
  fileItemImage: {
    width: scaledValue(40),
    height: scaledValue(40),
    marginLeft: scaledValue(16),
  },
  fileItemTextContainer: {
    marginLeft: scaledValue(13),
  },
  fileItemTitle: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    color: colors.darkPurple,
    letterSpacing: scaledValue(20 * -0.01),
  },
  fileItemSubtitle: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    opacity: 0.5,
  },
  button: {
    height: scaledValue(48),
    width: scaledValue(198),
    alignSelf: 'center',
    marginTop: scaledValue(40),
    backgroundColor: '#FDBD74',
    borderRadius: scaledValue(28),
    marginBottom: scaledValue(60),
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
});
