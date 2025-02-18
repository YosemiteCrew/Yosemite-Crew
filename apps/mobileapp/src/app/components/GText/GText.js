import React from 'react';
import {Text} from 'react-native';

const GText = props => {
  const {text, style, componentProps} = props;
  return (
    <Text
      {...componentProps}
      style={[
        {
          fontSize: fontSize(props),
          color: color(props),
          fontFamily: fontFamily(props),
        },
        style,
      ]}>
      {text}
    </Text>
  );
};

const fontSize = props => {
  if (props.g1) {
    return 17;
  } else if (props.g2) {
    return 15;
  } else if (props.g3) {
    return 13;
  } else if (props.g4) {
    return 11;
  }
  return 15;
};

const fontFamily = props => {
  if (props.bold) {
    return 'ClashDisplay-Bold';
  }
  if (props.light) {
    return 'ClashDisplay-Light';
  }
  if (props.Medium) {
    return 'ClashDisplay-Medium';
  }
  if (props.SemiBold) {
    return 'ClashDisplay-Semibold';
  }
  if (props.ExtraBold) {
    return 'ClashDisplay-Extralight';
  }
  if (props.GrMedium) {
    return 'ClashGrotesk-Medium';
  }
  if (props.SatoshiBlack) {
    return 'Satoshi-Black';
  }
  if (props.SatoshiBold) {
    return 'Satoshi-Bold';
  }
  if (props.SatoshiLight) {
    return 'Satoshi-Light';
  }
  if (props.SatoshiMedium) {
    return 'Satoshi-Medium';
  }
  if (props.SatoshiRegular) {
    return 'Satoshi-Regular';
  }
  return 'ClashDisplay-Regular';
};

const italic = props => {
  if (props.italic) {
    return true;
  }
  return false;
};

const color = props => {
  if (props.light) {
    return '#999';
  }
  return '#222';
};

export default GText;
