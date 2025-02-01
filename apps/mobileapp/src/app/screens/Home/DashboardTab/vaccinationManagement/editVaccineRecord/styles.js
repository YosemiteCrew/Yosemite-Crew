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
  row: {
    flexDirection: 'row',
  },
  oscarText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.appRed,
  },
  vaccinationText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.darkPurple,
    textAlign: 'center',
    marginTop: scaledValue(8),
  },
  recordsText: {
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    color: colors.darkPurple,
  },
  button: {
    alignSelf: 'center',
    marginTop: scaledValue(30),
    alignItems: 'center',
  },
  catImage: {
    width: scaledValue(40),
    height: scaledValue(40),
  },
  arrowImage: {
    width: scaledValue(16),
    height: scaledValue(16),
  },
  input: {
    width: '100%',
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    // lineHeight: scaledValue(16),
    marginTop: scaledValue(16),
    paddingLeft: scaledValue(10),
  },
  formContainer: {
    marginTop: scaledValue(16),
  },
  headerContainer: {
    marginTop: scaledValue(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
  },
  uploadContainer: {
    width: scaledValue(335),
    borderWidth: scaledValue(1),
    borderStyle: 'dashed',
    borderRadius: scaledValue(20),
    borderColor: '#37223C4D',
    marginTop: scaledValue(32),
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
  vaccineText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    opacity: 0.8,
    marginTop: scaledValue(34),
  },
  imageStyle: {
    width: scaledValue(100),
    height: scaledValue(100),
  },
  imgView: {
    marginTop: scaledValue(16),
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
  datePickerContainer: val => ({
    borderWidth: scaledValue(val ? 1 : 0.5),
    height: scaledValue(48),
    marginTop: scaledValue(16),
    borderRadius: scaledValue(24),
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderColor: val ? colors.primary : '#312943',
  }),
  dateText: val => ({
    fontSize: scaledValue(16),
    // lineHeight: scaledHeightValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    color: '#312943',
    fontFamily: val ? fonts?.SATOSHI_MEDIUM : fonts?.SATOSHI_REGULAR,
  }),
  dateIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
});
