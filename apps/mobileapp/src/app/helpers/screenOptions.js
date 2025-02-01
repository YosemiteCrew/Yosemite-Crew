import {CardStyleInterpolators} from '@react-navigation/stack';
import {Image, Platform, TouchableOpacity} from 'react-native';
import {getStatusBarHeight} from 'react-native-status-bar-height';
import React from 'react';
import {
  getFontSize,
  scaledHeightValue,
  scaledValue,
} from '../utils/design.utils';
import {fonts} from '../utils/fonts';
import {Images} from '../utils';
import {colors} from '../../assets/colors';
import HeaderButton from '../components/HeaderButton';

const getScreenOptions = ({
  title,
  customHeader = false,
  navigation,
  headerShown,
  headerStyle,
  presentation,
  animationEnabled,
  animationTypeForReplace,
  headerShadowVisible,
}) => {
  return {
    title: title,
    headerTitleAlign: 'center',
    headerShown: headerShown,
    presentation: presentation,
    headerShadowVisible: false,
    animationEnabled: animationEnabled ? animationEnabled : false,
    animationTypeForReplace: animationTypeForReplace,
    headerStyle: headerStyle
      ? headerStyle
      : customHeader
      ? {
          elevation: 0,
          // shadowColor: '#000',
          shadowOpacity: 0,
          height: getStatusBarHeight() + tabBarHeight() + customHeaderHeight(),
          // backgroundColor: 'red',
        }
      : {
          elevation: 0,
          // shadowColor: '#000',
          shadowOpacity: 0,
          backgroundColor: colors.themeColor,
        },
    headerTitleStyle: {
      color: colors.darkPurple,
      fontSize: getFontSize(18),
      lineHeight: scaledValue(21.6),
      fontFamily: fonts.CLASH_GRO_MEDIUM,
      letterSpacing: scaledValue(18 * -0.01),
    },
    cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
    gestureEnabled: true,
    // gestureDirection: 'horizontal',
    tabBarVisible: false,
    headerBackTitle: Platform.OS == 'ios' ? ' ' : '',
    headerBackTitleVisible: false,
    // headerBackImage: () => <GBack navigation={navigation} />,
  };
};

export default getScreenOptions;

const tabBarHeight = () => (Platform.OS == 'ios' ? 44 : 28);
const customHeaderHeight = () =>
  Platform.OS == 'ios' ? scaledHeightValue(24) : 0;

export const GBack = ({navigation}) => {
  return (
    <TouchableOpacity
      style={{paddingLeft: 10, paddingRight: 10}}
      onPress={() => {
        navigation.goBack();
      }}>
      <Image
        source={Images.leftArrow}
        style={{
          height: 25,
          width: 25,
        }}
      />
    </TouchableOpacity>
  );
};
