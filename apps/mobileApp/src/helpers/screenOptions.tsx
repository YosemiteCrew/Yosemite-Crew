// src/helpers/screenOptions.tsx
import {
  CardStyleInterpolators,
  StackNavigationOptions,
} from '@react-navigation/stack';
import { Image, Platform, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import React from 'react';
import {
  getFontSize,
  scaledHeightValue,
  scaledValue,
} from '../utils/design.utils';
import { fonts } from '../utils/fonts';
import { Images } from '../utils';
import { colors } from '../../assets/colors';

interface ScreenOptionsProps {
  title?: string;
  customHeader?: boolean;
  navigation: any;
  headerShown?: boolean;
  headerStyle?: StyleProp<ViewStyle>;
  presentation?: 'modal' | 'card';
  animationEnabled?: boolean;
  animationTypeForReplace?: 'push' | 'pop';
  headerShadowVisible?: boolean;
}

const getScreenOptions = ({
  title,
  customHeader = false,
  navigation,
  headerShown,
  headerStyle,
  presentation,
  animationEnabled,
  animationTypeForReplace,
}: ScreenOptionsProps): StackNavigationOptions => {
  return {
    title: title,
    headerTitleAlign: 'center',
    headerShown: headerShown,
    presentation: presentation,
    headerShadowVisible: false,
    animation: animationEnabled ? 'slide_from_right' : 'none',
    animationTypeForReplace: animationTypeForReplace,
    headerStyle: headerStyle
      ? headerStyle
      : customHeader
      ? {
          elevation: 0,
          shadowOpacity: 0,
          height: getStatusBarHeight() + tabBarHeight() + customHeaderHeight(),
        }
      : {
          elevation: 0,
          shadowOpacity: 0,
          backgroundColor: colors.paletteWhite,
        },
    headerTitleStyle: {
      fontSize: getFontSize(20),
      lineHeight: scaledValue(20 * 1.2),
      fontFamily: fonts.CLASH_GRO_MEDIUM,
      letterSpacing: scaledValue(20 * -0.01),
    },
    cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
    gestureEnabled: true,
    // 👇 This line was removed to fix the type error
    // headerBackTitleVisible: false,
  };
};

export default getScreenOptions;

const tabBarHeight = (): number => (Platform.OS === 'ios' ? 44 : 28);
const customHeaderHeight = (): number =>
  Platform.OS === 'ios' ? scaledHeightValue(24) : 0;

interface GBackProps {
  navigation: any;
}

export const GBack: React.FC<GBackProps> = ({ navigation }) => {
  return (
    <TouchableOpacity
      style={{ paddingLeft: 10, paddingRight: 10 }}
      onPress={() => {
        navigation.goBack();
      }}>
      <Image
        // 👇 This line was updated with the correct image name
        source={Images.Left_Circle_Arrow}
        style={{
          height: 25,
          width: 25,
        }}
      />
    </TouchableOpacity>
  );
};