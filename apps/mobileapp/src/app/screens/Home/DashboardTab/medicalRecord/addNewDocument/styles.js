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
    paddingHorizontal: scaledValue(20),
  },
  ongoingText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.appRed,
  },
  plansText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.darkPurple,
    textTransform: 'lowercase',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(30),
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
  },
  headerImageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catImage: {
    width: scaledValue(40),
    height: scaledValue(40),
    marginRight: scaledValue(3),
  },
  arrowDownImage: {
    width: scaledValue(16),
    height: scaledValue(16),
    marginLeft: scaledValue(1),
  },
  inputContainer: {
    marginTop: scaledValue(20),
  },
  iconStyle: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  input: {
    width: '100%',
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    // lineHeight: scaledValue(16),
    marginTop: scaledValue(16),
    paddingLeft: scaledValue(10),
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: scaledValue(16),
    paddingHorizontal: scaledValue(12),
  },
  dateText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
    color: colors.darkPurple,
  },
  uploadContainer: {
    width: scaledValue(335),
    borderWidth: scaledValue(1),
    borderStyle: 'dashed',
    borderRadius: scaledValue(20),
    borderColor: '#37223C4D',
    marginTop: scaledValue(36),
    alignSelf: 'center',
  },
  uploadImage: {
    width: scaledValue(40),
    height: scaledValue(40),
    alignSelf: 'center',
    marginTop: scaledValue(16),
  },
  uploadText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.darkPurple,
    textAlign: 'center',
    paddingHorizontal: scaledValue(53),
    marginTop: scaledValue(10),
  },
  documentText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    textAlign: 'center',
    paddingHorizontal: scaledValue(53),
    opacity: 0.7,
    marginTop: scaledValue(10),
    marginBottom: scaledValue(16),
  },
  buttonText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.brown,
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
  },
  buttonStyle: {
    backgroundColor: '#FDBD74',
    marginTop: scaledValue(40),
    marginBottom: scaledValue(62),
    height: scaledValue(52),
    borderRadius: scaledValue(28),
  },
  imgContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(16),
  },
  addImgButton: {
    marginLeft: scaledValue(16),
    width: scaledValue(100),
    height: scaledValue(100),
    borderWidth: scaledValue(1),
    borderColor: '#37223C4D',
    borderStyle: 'dashed',
    borderRadius: scaledValue(4),
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageStyle: {
    width: scaledValue(100),
    height: scaledValue(100),
  },
  crossStyle: {
    width: scaledValue(24),
    height: scaledValue(24),
  },
  crossImgView: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  imgContentStyle: {
    gap: scaledValue(16),
  },
  PlusIconImage: {
    width: scaledValue(24),
    height: scaledValue(24),
  },
  vaccineText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    opacity: 0.8,
    marginTop: scaledValue(24),
  },
  professionalButton: {
    borderWidth: scaledValue(0.5),
    height: scaledValue(48),
    marginTop: scaledValue(20),
    borderRadius: scaledValue(24),
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  professionalText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    color: '#312943',
  },
});
