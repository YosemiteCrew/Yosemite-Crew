import React from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../../hooks';

interface LoadingProps {
  text?: string;
  size?: 'small' | 'large';
  color?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  text = 'Loading...',
  size = 'large',
  color,
}) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator
        size={size}
        color={color || theme.colors.primary}
      />
      {text && (
        <Text style={[styles.text, { color: theme.colors.text }]}>
          {text}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});
