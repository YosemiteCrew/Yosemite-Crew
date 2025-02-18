import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {fonts} from '../../../utils/fonts';
import {colors} from '../../../../assets/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.themeColor,
  },
  profileImage: {
    width: scaledValue(200),
    height: scaledValue(201.38),
    alignSelf: 'center',
  },
  headerText: {
    fontSize: scaledValue(26),
    lineHeight: scaledHeightValue(31.2),
    letterSpacing: scaledValue(26 * -0.01),
    color: colors.darkPurple,
    textAlign: 'center',
    marginTop: scaledValue(24),
  },
  subHeaderText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
    color: colors.darkPurple,
    textAlign: 'center',
    marginTop: scaledValue(8),
    paddingHorizontal: scaledValue(44),
  },
  listContainer: {
    marginTop: scaledValue(16.38),
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: scaledValue(58),
    marginTop: scaledValue(23.62),
  },
  icon: {
    width: scaledValue(28),
    height: scaledValue(28),
  },
  itemText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    width: '70%',
    marginLeft: scaledValue(12),
  },
  createButton: {
    backgroundColor: '#FDBD74',
    width: '90%',
    height: scaledValue(52),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: scaledValue(68),
  },
  buttonText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(16 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    color: colors.brown,
  },
  skipButton: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.appRed,
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    textAlign: 'center',
    marginTop: scaledValue(17),
  },

  modalContainer: {
    backgroundColor: colors.white,
    height: scaledValue(620.13),
    borderRadius: scaledValue(24),
    paddingVertical: scaledValue(30),
  },

  rewardImage: {
    width: scaledValue(280),
    height: scaledValue(248.13),
    alignSelf: 'center',
    marginHorizontal: scaledValue(27.5),
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scaledValue(24),
  },
  titleRedText: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.appRed,
  },
  titleBlackText: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: '#1C1C1E',
  },
  descText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
    textAlign: 'center',
    color: colors.jetLightBlack,
    marginHorizontal: scaledValue(24),
    marginTop: scaledValue(4),
    marginBottom: scaledValue(24),
  },
  addPetButton: {
    backgroundColor: colors.appRed,
    width: '85%',
    height: scaledValue(44),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: scaledValue(24),
  },
  buttonIcon: {
    width: scaledValue(16),
    height: scaledValue(16),
  },
  addPetButtonText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16),
    letterSpacing: scaledValue(16 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    color: colors.white,
    marginLeft: scaledValue(6),
    top: scaledValue(2),
  },
});
