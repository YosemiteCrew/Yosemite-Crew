import {StyleSheet} from 'react-native';
import {
  getFontSize,
  scaledHeightValue,
  scaledValue,
} from '../../../../utils/design.utils';
import {fonts} from '../../../../utils/fonts';
import {colors} from '../../../../../assets/colors';

export const styles = StyleSheet.create({
  dashboardMainView: {
    paddingHorizontal: scaledValue(20),
    flex: 1,
    backgroundColor: colors.themeColor,
  },
  scrollView: {
    flex: 1,
  },
  headerRight: {
    // paddingRight: scaledValue(20),
  },
  headerLeft: {
    // paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: scaledValue(28),
    height: scaledValue(28),
  },
  buttonText: {
    fontSize: scaledValue(18),
    // lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.brown,
    fontFamily: fonts.CLASH_GRO_MEDIUM,
  },

  buttonStyle: {
    height: scaledValue(52),
    borderRadius: scaledValue(28),
    marginTop: scaledValue(90),
    backgroundColor: '#FDBD74',
  },
  imageBackground: {
    width: scaledValue(375),
    height: scaledValue(353.75),
    alignSelf: 'center',
    paddingHorizontal: scaledValue(20),
  },
  headerView: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contactText: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.darkPurple,
  },
  helpTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: scaledValue(5),
    marginBottom: scaledValue(16),
  },
  happyText: {
    fontSize: scaledValue(29),
    lineHeight: scaledValue(34.8),
    letterSpacing: scaledValue(29 * -0.01),
    color: colors.appRed,
  },
  helpText: {
    fontSize: scaledValue(29),
    lineHeight: scaledValue(34.8),
    letterSpacing: scaledValue(29 * -0.01),
    color: colors.darkPurple,
  },
  inputStyle: {
    width: '100%',
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    // lineHeight: scaledValue(16),
    marginTop: scaledValue(20),
    paddingLeft: scaledValue(10),
  },
  textInputStyle: {
    borderWidth: scaledValue(0.5),
    height: scaledValue(114),
    marginTop: scaledValue(20),
    borderRadius: scaledValue(16),
    borderColor: '#312943',
    paddingHorizontal: scaledValue(18),
    paddingTop: scaledValue(12),
    textAlignVertical: 'top',
    fontSize: scaledValue(16),
    color: colors.darkPurple,
  },
  contactOptionMainView: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scaledValue(12.5),
  },
  professionalButton: {
    borderWidth: scaledValue(0.5),
    height: scaledValue(48),
    borderRadius: scaledValue(24),
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaledValue(36),
  },
  professionalText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    color: '#312943',
  },
  arrowIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  submitRequestView: (index, submitRequestList) => ({
    flexDirection: 'row',
    marginBottom: index == submitRequestList.length - 1 ? 0 : scaledValue(16),
  }),
  radioButton: {
    width: scaledValue(20),
    height: scaledValue(20),
    marginRight: scaledValue(8),
  },
  submitRequestItemName: (selectedSubmitRequest, item) => ({
    color:
      selectedSubmitRequest == item?.id ? colors.appRed : colors.darkPurple,
    fontSize: getFontSize(16),
    lineHeight: scaledValue(19.2),
    fontFamily:
      selectedSubmitRequest == item?.id
        ? fonts.SATOSHI_BOLD
        : fonts.SATOSHI_REGULAR,
    flexShrink: 1,
  }),
  underRightText: {
    color: colors.jetBlack,
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    marginTop: scaledValue(44),
    marginBottom: scaledValue(12),
  },
  optionTitleText: {
    color: colors.jetBlack,
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    marginTop: scaledValue(20),
    marginBottom: scaledValue(16),
  },
  submittingRequestToText: {
    color: colors.jetBlack,
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    marginBottom: scaledValue(16),
  },

  leaveDetailsText: {
    color: colors.jetBlack,
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    marginTop: scaledValue(36),
  },
});
