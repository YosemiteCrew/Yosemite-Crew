import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {fonts} from '../../../utils/fonts';
import {colors} from '../../../../assets/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paletteWhite,
    paddingHorizontal: scaledValue(20),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {position: 'absolute', left: 0},
  icon: {width: scaledValue(28), height: scaledValue(28)},
  title: {
    fontSize: scaledValue(20),
    letterSpacing: scaledValue(-0.2),
    color: colors.jetBlack,
    textAlign: 'center',
  },
  image: {
    width: scaledValue(311.82),
    height: scaledValue(201.22),
    marginTop: scaledValue(34),
    alignSelf: 'center',
  },
  subtitle: {
    fontSize: scaledValue(23),
    letterSpacing: scaledValue(-0.23),
    color: colors.jetBlack,
    textAlign: 'center',
    marginTop: scaledValue(22.78),
  },
  desc: {
    fontSize: scaledValue(16),
    letterSpacing: scaledValue(-0.32),
    color: colors.jetBlack,
    textAlign: 'center',
    marginTop: scaledValue(8),
    lineHeight: scaledHeightValue(19.2),
    paddingHorizontal: scaledValue(30),
  },
  row: {flexDirection: 'row', marginTop: scaledValue(20)},
  iconWrap: {
    width: scaledValue(48),
    height: scaledValue(48),
    borderRadius: scaledValue(24),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9F2FD',
  },
  iconText: {fontSize: scaledValue(24)},
  textWrap: {marginLeft: scaledValue(12), gap: scaledValue(4)},
  rewardTitle: {
    fontSize: scaledValue(16),
    letterSpacing: scaledValue(-0.32),
    color: colors.jetBlack,
  },
  rewardDesc: {
    fontSize: scaledValue(13),
    color: colors.jetBlack300,
    lineHeight: scaledHeightValue(15.6),
    width: '60%',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaledValue(16),
  },
  btnOutline: {
    paddingVertical: scaledValue(17),
    paddingHorizontal: scaledValue(36),
    borderWidth: scaledValue(1),
    borderColor: colors.jetBlack,
    borderRadius: scaledValue(28),
  },
  btnOutlineText: {
    fontSize: scaledValue(18),
    letterSpacing: scaledValue(-0.18),
    color: colors.jetBlack,
  },
  btnSolid: {
    paddingVertical: scaledValue(17),
    paddingHorizontal: scaledValue(44),
    backgroundColor: colors.jetBlack,
    borderRadius: scaledValue(28),
  },
  btnSolidText: {
    color: colors.paletteWhite,
    fontSize: scaledValue(18),
    letterSpacing: scaledValue(-0.18),
  },
  rowUpperView: {marginTop: scaledValue(12)},
});
