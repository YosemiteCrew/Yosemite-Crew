import React from 'react';
import {Pressable, type PressableProps} from 'react-native';

import {getPressableOpacityStyle} from './pressableOpacityStyles';

type PressableOpacityProps = Omit<PressableProps, 'style'> & {
  activeOpacity?: number;
  ref?: React.Ref<React.ComponentRef<typeof Pressable>>;
  style?: NonNullable<PressableProps['style']>;
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
    disabled: Boolean(disabled),
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
