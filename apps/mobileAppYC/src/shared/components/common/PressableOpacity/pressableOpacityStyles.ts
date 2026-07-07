import type {PressableProps, PressableStateCallbackType} from 'react-native';

type PressableOpacityStyleOptions = {
  activeOpacity: number;
  disabled?: boolean | null;
  style?: PressableProps['style'];
};

export const getPressableOpacityStyle =
  ({activeOpacity, disabled, style}: PressableOpacityStyleOptions) =>
  (state: PressableStateCallbackType) => [
    typeof style === 'function' ? style(state) : style,
    state.pressed && !disabled ? {opacity: activeOpacity} : null,
  ];
