import {Image, StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {colors} from '../../../../assets/colors';
import {Images} from '../../../utils';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GText from '../../../components/GText/GText';

const ForgotPassword = () => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.themeColor,
        paddingHorizontal: scaledValue(20),
      }}>
      <View
        style={{
          marginTop: statusBarHeight + scaledValue(15.67),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Image
          source={Images.Left_Circle_Arrow}
          style={{
            width: scaledValue(28),
            height: scaledValue(28),
            position: 'absolute',
            left: 0,
          }}
        />
        <GText
          GrMedium
          text={'Forgot Password'}
          style={{
            fontSize: scaledValue(20),
            lineHeight: scaledHeightValue(24),
            letterSpacing: scaledValue(20 * -0.01),
          }}
        />
      </View>
      <Image
        source={Images.Lost_Password}
        style={{
          width: scaledValue(140.78),
          height: scaledValue(150),
          marginTop: scaledValue(27),
          alignSelf: 'center',
        }}
      />
    </View>
  );
};

export default ForgotPassword;

const styles = StyleSheet.create({});
