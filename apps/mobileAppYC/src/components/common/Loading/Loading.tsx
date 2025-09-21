import React from 'react';
import {View, ActivityIndicator, Text, StyleSheet} from 'react-native';
import {useTheme} from '../../../hooks';

interface LoadingProps {
  size?: 'small' | 'large';
  text?: string;
  overlay?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'large',
  text,
  overlay = false,
}) => {
  const {theme} = useTheme();

  const containerStyle = overlay
    ? {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.colors.overlay,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        zIndex: 9999,
      }
    : {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.colors.background,
      };

  return (
    <View style={containerStyle}>
      <ActivityIndicator size={size} color={theme.colors.primary} />
      {text && (
        <Text
          style={[
            theme.typography.body,
            {
              color: overlay ? theme.colors.surface : theme.colors.text,
              marginTop: theme.spacing['4'],
              textAlign: 'center',
            },
          ]}>
          {text}
        </Text>
      )}
    </View>
  );
};