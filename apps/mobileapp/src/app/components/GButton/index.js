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
      activeOpacity={0.5}
      disabled={disabled}
      style={[
        {
          padding: 10,
          borderRadius: 12,
          backgroundColor: disabled || loading ? '#ccc' : colors.themeColor,
          alignContent: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: icon ? 'row' : 'column',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      onPress={disabled || loading ? null : onPress}>
      <View />
      {icon && <Image source={icon} style={iconStyle} />}
      <GText Medium style={[{color: 'white'}, textStyle]} text={title} />
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
