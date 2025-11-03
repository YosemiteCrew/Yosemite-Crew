/* eslint-disable react-native/no-inline-styles */
// src/components/common/SafeArea.tsx
import React from 'react';
import { View, StatusBar, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks';

interface SafeAreaProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: ReadonlyArray<Edge>;
  mode?: 'padding' | 'margin';
}

export const SafeArea: React.FC<SafeAreaProps> = ({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'], // Default to all edges
  mode = 'padding',
}) => {
  const { theme, isDark } = useTheme();

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
        translucent={false}
      />
      <SafeAreaView
        style={[
          { flex: 1, backgroundColor: theme.colors.background },
          style,
        ]}
        edges={edges}
        mode={mode}
      >
        {children}
      </SafeAreaView>
    </>
  );
};

// Alternative hook-based implementation for more control
export const SafeAreaWithHook: React.FC<{
  children: React.ReactNode;
  style?: ViewStyle;
}> = ({ children, style }) => {
  const { theme, isDark } = useTheme();
  
  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
        translucent={false}
      />
      <View
        style={[
          { flex: 1, backgroundColor: theme.colors.background },
          style,
        ]}
      >
        {children}
      </View>
    </>
  );
};
