import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {fonts} from '../../../utils/fonts';
import {colors} from '../../../../assets/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.themeColor,
    paddingHorizontal: scaledValue(20),
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
  },
  backButtonImage: {
    width: scaledValue(28),
    height: scaledValue(28),
  },
  headerTextContainer: {
    flexDirection: 'row',
    width: '60%',
  },
  headerText: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.darkPurple,
  },
  headerTextHighlighted: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    left: scaledValue(2),
    color: colors.appRed,
    width: '50%',
  },
  profileImageContainer: {
    alignItems: 'center',
    marginTop: scaledValue(48),
    width: scaledValue(100),
    height: scaledValue(100),
    alignSelf: 'center',
  },
  profileImage: {
    width: scaledValue(100),
    height: scaledValue(100),
    borderRadius: scaledValue(50),
  },
  formContainer: {
    marginTop: scaledValue(13),
  },
  input: {
    width: '100%',
    backgroundColor: 'transparent',
    fontSize: scaledValue(14),
    // lineHeight: scaledValue(16),
    marginTop: scaledValue(16),
    paddingLeft: scaledValue(10),
  },
  datePickerContainer: {
    borderWidth: scaledValue(0.5),
    height: scaledValue(48),
    marginTop: scaledValue(16),
    borderRadius: scaledValue(24),
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderColor: '#312943',
  },
  dateText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    color: '#312943',
  },
  dateIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  genderContainer: {
    marginTop: scaledValue(16),
    flexDirection: 'row',
    gap: scaledValue(8),
  },
  genderItem: {
    borderRadius: scaledValue(28),
  },
  genderButton: {
    width: scaledValue(100),
    borderRadius: scaledValue(28),
    height: scaledValue(48),
    justifyContent: 'center',
    alignItems: 'center',
  },
  genderText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
  },
  weightContainer: {
    borderWidth: scaledValue(0.5),
    height: scaledValue(48),
    marginTop: scaledValue(16),
    borderRadius: scaledValue(24),
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderColor: '#312943',
  },
  weightText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    color: '#312943',
  },
  weightIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weightUnitText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    color: colors.appRed,
  },
  weightIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  bloodGroupContainer: {
    borderWidth: scaledValue(0.5),
    height: scaledValue(48),
    marginTop: scaledValue(16),
    borderRadius: scaledValue(24),
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderColor: '#312943',
  },
  bloodGroupText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    color: '#312943',
  },
  bloodGroupIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  neuteredContainer: {
    marginTop: scaledValue(16),
    flexDirection: 'row',
    gap: scaledValue(8),
  },
  neuteredItem: {
    borderRadius: scaledValue(28),
  },
  neuteredButton: {
    borderRadius: scaledValue(28),
    height: scaledValue(48),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scaledValue(25),
  },
  neuteredText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
  },
  createButton: {
    backgroundColor: '#FDBD74',
    width: '100%',
    height: scaledValue(52),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: scaledValue(40),
    marginBottom: scaledValue(40),
  },
  createButtonText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    color: '#4E3F2F',
  },
});
