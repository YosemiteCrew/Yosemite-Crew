import React from 'react';
import {TouchableOpacity} from 'react-native';
import GText from '../GText/GText';
import {fonts} from '../../utils/fonts';

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
          {color: '#fff', fontFamily: fonts.CLASH_DISPLAY_BOLD},
          titleStyle,
        ]}
        text={title}
      />
    </TouchableOpacity>
  );
};

export default GTextButton;
