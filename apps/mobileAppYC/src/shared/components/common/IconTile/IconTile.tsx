// src/shared/components/common/IconTile/IconTile.tsx
//
// Warm-bone icon tile: a per-item tinted rounded-square (or circle) that holds
// a small icon. Purely presentational - press handling stays on the row that
// hosts it. Tones map onto the same warm-bone surface tokens as Badge so the
// tile tracks the active (light or espresso) theme with no hard-coded colours.

import React, {useMemo} from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';

export type IconTileTone =
  | 'neutral'
  | 'info'
  | 'indigo'
  | 'violet'
  | 'success'
  | 'warning'
  | 'danger'
  | 'brand';

export type IconTileShape = 'circle' | 'rounded';
export type IconTileSize = 'sm' | 'md' | 'lg';

export interface IconTileProps {
  /** Image icon rendered inside the tile. */
  icon?: ImageSourcePropType;
  /** Escape hatch for an SVG / glyph node instead of an image. */
  iconNode?: React.ReactNode;
  /** Warm-bone surface tint. Defaults to 'neutral'. */
  tone?: IconTileTone;
  /** A 'rounded' square (default) or a full 'circle'. */
  shape?: IconTileShape;
  /** Preset ('sm' 40 | 'md' 44 | 'lg' 48) or an explicit pixel size. */
  size?: IconTileSize | number;
  /** Icon dimension in px. Defaults to ~half the tile. */
  iconSize?: number;
  /** Tints the icon (single-colour images only). Omitted = icon keeps its own colours. */
  iconTintColor?: string;
  /** Overrides the tone-derived background. */
  backgroundColor?: string;
  /** Image resize mode. Defaults to 'contain'. */
  iconResizeMode?: 'contain' | 'cover';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SIZE_PRESETS: Record<IconTileSize, number> = {
  sm: 40,
  md: 44,
  lg: 48,
};

const toneBackground = (theme: Theme, tone: IconTileTone): string => {
  const {colors} = theme;
  switch (tone) {
    case 'info':
      return colors.blueSoft;
    case 'indigo':
      return colors.indigoSurface;
    case 'violet':
      return colors.violetSurface;
    case 'success':
      return colors.successSurface;
    case 'warning':
      return colors.warningSurface;
    case 'danger':
      return colors.dangerSurface;
    case 'brand':
      return colors.cardBackground;
    default:
      return colors.screen2;
  }
};

export const IconTile: React.FC<IconTileProps> = ({
  icon,
  iconNode,
  tone = 'neutral',
  shape = 'rounded',
  size = 'md',
  iconSize,
  iconTintColor,
  backgroundColor,
  iconResizeMode = 'contain',
  style,
  testID,
}) => {
  const {theme} = useTheme();

  const tileSize = typeof size === 'number' ? size : SIZE_PRESETS[size];
  const resolvedIconSize = iconSize ?? Math.round(tileSize * 0.5);
  const bg = backgroundColor ?? toneBackground(theme, tone);
  const radius =
    shape === 'circle' ? theme.borderRadius.full : theme.borderRadius.lg;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        tile: {
          width: tileSize,
          height: tileSize,
          borderRadius: radius,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        icon: {
          width: resolvedIconSize,
          height: resolvedIconSize,
          ...(iconTintColor ? {tintColor: iconTintColor} : null),
        },
      }),
    [tileSize, radius, bg, resolvedIconSize, iconTintColor],
  );

  return (
    <View testID={testID} style={[styles.tile, style]}>
      {iconNode ??
        (icon ? (
          <Image
            source={icon}
            style={styles.icon}
            resizeMode={iconResizeMode}
          />
        ) : null)}
    </View>
  );
};

export default IconTile;
