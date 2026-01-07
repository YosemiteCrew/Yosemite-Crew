import React from 'react';
import {View, StyleSheet} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useTheme} from '@/hooks';

interface BottomFadeOverlayProps {
  height?: number;
  intensity?: 'light' | 'medium' | 'strong';
  bottomOffset?: number;
}

export const BottomFadeOverlay: React.FC<BottomFadeOverlayProps> = ({
  height = 80,
  intensity = 'medium',
  bottomOffset = 0,
}) => {
  const {theme} = useTheme();

  // Convert hex to rgba if needed
  const parseColor = (color: string): string => {
    if (color.startsWith('#')) {
      const r = Number.parseInt(color.slice(1, 3), 16);
      const g = Number.parseInt(color.slice(3, 5), 16);
      const b = Number.parseInt(color.slice(5, 7), 16);
      return `rgb(${r}, ${g}, ${b})`;
    }
    return color;
  };

  const baseColorRgb = parseColor(theme.colors.background);
  let midOpacity = 0.65;
  if (intensity === 'light') {
    midOpacity = 0.4;
  } else if (intensity === 'strong') {
    midOpacity = 0.85;
  }

  // Gradient from transparent at top to background color at bottom
  const gradientColors = [
    baseColorRgb.replace('rgb', 'rgba').replace(')', ', 0)'), // Fully transparent at top
    baseColorRgb.replace('rgb', 'rgba').replace(')', `, ${midOpacity})`),
    baseColorRgb, // Fully opaque at bottom
  ];

  return (
    <View style={[styles.container, {height, bottom: bottomOffset}]} pointerEvents="none">
      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
        locations={[0, 0.4, 1]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  gradient: {
    flex: 1,
  },
});
