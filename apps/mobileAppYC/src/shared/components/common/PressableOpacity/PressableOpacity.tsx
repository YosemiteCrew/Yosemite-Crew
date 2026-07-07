import React from 'react';
import {Pressable, type PressableProps} from 'react-native';

import {getPressableOpacityStyle} from './pressableOpacityStyles';

type PressableOpacityProps = Omit<PressableProps, 'style'> & {
  activeOpacity?: number;
  ref?: React.Ref<React.ElementRef<typeof Pressable>>;
  style?: PressableProps['style'];
};

export function PressableOpacity({
  activeOpacity = 0.2,
  disabled,
  ref,
  style,
  ...props
}: PressableOpacityProps) {
  const pressableStyle = getPressableOpacityStyle({
    activeOpacity,
    disabled,
    style,
  });

  return (
    <Pressable
      {...props}
      ref={ref}
      disabled={disabled}
      style={pressableStyle}
    />
  );
}
