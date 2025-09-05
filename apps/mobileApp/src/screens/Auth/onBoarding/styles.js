import {Dimensions, Platform, StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {colors} from '../../../../assets/colors';
import {fonts} from '../../../utils/fonts';

export const styles = StyleSheet.create({
  //--------- Common Styles ---------//
  onboardingMainContainer: {backgroundColor: '#FFFEFE', flex: 1},
  onboardingTitleView: statusBarHeight => ({
    marginTop: statusBarHeight + scaledValue(90),
  }),
  onboardingTitleStyle: {
    fontSize: scaledValue(36),
    lineHeight: scaledHeightValue(43.2),
    letterSpacing: scaledValue(36 * -0.02),
    textAlign: 'center',
  },
  onboardingSecondTitleStyle: color => ({
    fontSize: scaledValue(36),
    lineHeight: scaledHeightValue(43.2),
    letterSpacing: scaledValue(36 * -0.02),
    textAlign: 'center',
    color: colors.jetBlack300,
  }),

  indicator: {
    width: scaledValue(40),
    height: scaledValue(4),
    alignSelf: 'center',
    marginTop: scaledValue(28),
  },

  //--------- First Onboarding Styles ---------//

  firstScreenTitleView: statusBarHeight => ({
    marginTop: statusBarHeight + scaledValue(149),
  }),
  petHealthText: {
    fontSize: scaledValue(36),
    lineHeight: scaledHeightValue(36),
    letterSpacing: scaledValue(36 * -0.02),
    textAlign: 'center',
  },
  simplifiedText: {
    fontSize: scaledValue(36),
    lineHeight: scaledHeightValue(36),
    letterSpacing: scaledValue(36 * -0.02),
    textAlign: 'center',
    color: colors.jetBlack300,
  },

  firstScreenFirstPlusImage: {
    width: scaledValue(12.83),
    height: scaledValue(13.87),
    marginTop: scaledValue(71),
    marginLeft: scaledValue(81),
  },
  firstScreenSecondPlusImage: {
    width: scaledValue(12.83),
    height: scaledValue(13.87),
    marginTop: scaledValue(51.13),
    marginRight: scaledValue(70.17),
    alignSelf: 'flex-end',
    bottom: scaledValue(10),
  },
  firstScreenBgEclipse: {
    width: '100%',
    height: scaledValue(380.51),
    alignSelf: 'center',
  },
  firstScreenSecondBgEclipse: {
    width: '100%',
    height: scaledValue(380.51),
    marginTop: scaledValue(20),
    alignSelf: 'center',
  },
  firstScreenBgImage: insets => ({
    width: scaledValue(360),
    height: scaledValue(355),
    alignSelf: 'center',
    // bottom:
    //   Platform.OS == 'android'
    //     ? scaledValue(insets.bottom + 25)
    //     : scaledValue(insets.bottom - 10),
  }),

  //--------- Second Onboarding Styles ---------//

  secondScreenFirstPlusImage: {
    width: scaledValue(12.83),
    height: scaledValue(13.87),
    marginTop: scaledValue(65),
    marginRight: scaledValue(72.17),
    alignSelf: 'flex-end',
  },
  secondScreenSecondPlusImage: {
    width: scaledValue(12.83),
    height: scaledValue(13.87),
    marginTop: scaledValue(55),
    marginLeft: scaledValue(86),
    marginBottom: scaledValue(10),
  },

  secondScreenEclipseImageView: {marginTop: scaledValue(-10)},

  secondScreenBgEclipse: {
    width: '100%',
    height: scaledValue(420.51),
    alignSelf: 'center',
  },
  secondScreenSecondBgEclipse: {
    width: '100%',
    height: scaledValue(420.51),
    marginTop: scaledValue(20),
    alignSelf: 'center',
  },
  secondScreenBgImage: insets => ({
    width: '100%',
    height: scaledValue(420.51),
    alignSelf: 'center',
    // bottom:
    //   Platform.OS == 'android'
    //     ? scaledValue(insets.bottom + 100)
    //     : scaledValue(insets.bottom + 65),
  }),

  //--------- Third Onboarding Styles ---------//
  thirdScreenEclipseImageView: {marginTop: scaledValue(150)},
  thirdScreenBgEclipse: {
    width: '100%',
    height: scaledValue(370.51),
    alignSelf: 'center',
  },
  thirdScreenSecondBgEclipse: {
    width: '100%',
    height: scaledValue(350.51),
    marginTop: scaledValue(20),
    alignSelf: 'center',
  },
  thirdScreenBgImage: insets => ({
    width: '100%',
    height: scaledValue(380),
    alignSelf: 'center',
  }),

  //--------- Forth Onboarding Styles ---------//
  forthScreenFirstPlusImage: {
    width: scaledValue(12.83),
    height: scaledValue(13.87),
    marginTop: scaledValue(38),
    marginRight: scaledValue(87.17),
    alignSelf: 'flex-end',
    bottom: scaledValue(3),
  },
  getStartedBtn: {
    width: scaledValue(160),
    height: scaledValue(50),
    alignSelf: 'center',
    borderRadius: scaledValue(28),
    backgroundColor: colors.jetBlack,
  },
  getStartedTextBtn: {
    fontSize: scaledValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.paletteWhite,
    fontFamily: fonts.CLASH_GRO_MEDIUM,
  },
  forthScreenEclipseImageView: {
    marginTop: Platform.OS == 'android' ? scaledValue(90) : scaledValue(70),
  },
  forthScreenBgEclipse: {
    width: '100%',
    height: scaledValue(380.51),
    alignSelf: 'center',
  },
  forthScreenSecondEclipse: {
    width: '100%',
    height:
      Platform.OS == 'android' ? scaledValue(320.51) : scaledValue(360.51),
    marginTop: scaledValue(20),
    alignSelf: 'center',
  },
  forthScreenBgImage: {
    width: '100%',
    height: scaledValue(400),
    alignSelf: 'center',
    bottom:
      Platform.OS == 'android'
        ? Dimensions.get('screen').height / 2.1
        : Dimensions.get('screen').height / 1.8,
  },
});
