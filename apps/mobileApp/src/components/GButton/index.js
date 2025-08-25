import React, {useEffect} from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  TouchableNativeFeedback,
  ActivityIndicator,
  Image,
} from 'react-native';
import GText from '../GText/GText';
import {colors} from '../../../assets/colors';
import {scaledValue} from '../../utils/design.utils';

const GButton = props => {
  const {
    title,
    style,
    onPress,
    disabled,
    loading,
    textStyle,
    icon,
    iconStyle,
    key,
  } = props;
  return (
    <TouchableOpacity
      key={key}
      activeOpacity={0.9}
      disabled={disabled}
      style={[
        {
          padding: 10,
          height: scaledValue(52),
          borderRadius: scaledValue(28),
          backgroundColor: colors.jetBlack,
          alignContent: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: icon ? 'row' : 'column',
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
      onPress={disabled || loading ? null : onPress}>
      <View />
      {icon && (
        <Image
          source={icon}
          style={[{width: scaledValue(20), height: scaledValue(20)}, iconStyle]}
        />
      )}
      <GText
        GrMedium
        style={[
          {
            color: colors.paletteWhite,
            fontSize: scaledValue(18),
            letterSpacing: scaledValue(18 * -0.01),
          },
          textStyle,
        ]}
        text={title}
      />
      {loading && (
        <ActivityIndicator
          color="#fff"
          style={{position: 'absolute', right: 10}}
        />
      )}
    </TouchableOpacity>
  );
};

export default GButton;
