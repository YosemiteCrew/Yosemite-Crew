// src/components/common/SafeArea.tsx
import React from 'react';
import { View, StatusBar, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';

type EdgeMode = 'off' | 'additive' | 'maximum';
type Edge = 'top' | 'bottom' | 'left' | 'right';

interface SafeAreaProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[] | { [key in Edge]?: EdgeMode };
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