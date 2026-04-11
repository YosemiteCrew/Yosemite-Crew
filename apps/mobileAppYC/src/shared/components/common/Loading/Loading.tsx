import React from 'react';
import {View, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks';
import {GifLoader} from '../GifLoader/GifLoader';

interface LoadingProps {
  size?: 'small' | 'medium' | 'large';
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'medium',
}) => {
  const {theme} = useTheme();

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <GifLoader size={size} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
