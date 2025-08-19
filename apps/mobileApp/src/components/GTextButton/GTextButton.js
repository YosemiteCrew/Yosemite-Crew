import React from 'react';
import {TouchableOpacity} from 'react-native';
import GText from '../GText/GText';
import {fonts} from '../../utils/fonts';
import {colors} from '../../../assets/colors';
import {scaledValue} from '../../utils/design.utils';

const GTextButton = props => {
  const {title, style, titleStyle, onPress, disabled, hitSlop} = props;
  return (
    <TouchableOpacity
      hitSlop={hitSlop}
      disabled={disabled}
      style={style}
      onPress={onPress}>
      <GText
        style={[
          {
            color: colors.jetBlack,
            fontFamily: fonts.SATOSHI_BOLD,
            fontSize: scaledValue(16),
            letterSpacing: scaledValue(16 * -0.02),
          },
          titleStyle,
        ]}
        text={title}
      />
    </TouchableOpacity>
  );
};

export default GTextButton;
