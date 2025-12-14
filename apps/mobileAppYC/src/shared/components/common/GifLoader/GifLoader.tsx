import React from 'react';
import {StyleSheet, View} from 'react-native';
import FastImage, {
  ImageStyle as FastImageStyle,
} from '@d11/react-native-fast-image';
import {Images} from '@/assets/images';

interface GifLoaderProps {
  size?: 'small' | 'medium' | 'large';
  style?: FastImageStyle;
}

export const GifLoader: React.FC<GifLoaderProps> = ({
  size = 'medium',
  style,
}) => {
  const getLoaderStyle = () => {
    let baseStyle = styles.loaderLarge;
    if (size === 'small') {
      baseStyle = styles.loaderSmall;
    } else if (size === 'medium') {
      baseStyle = styles.loaderMedium;
    }
    return style ? [baseStyle, style] : baseStyle;
  };

  return (
    <View style={styles.container}>
      <FastImage
        source={Images.yosemiteLoader}
        style={getLoaderStyle()}
        resizeMode={FastImage.resizeMode.contain}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderSmall: {
    width: 60,
    height: 60,
  },
  loaderMedium: {
    width: 100,
    height: 100,
  },
  loaderLarge: {
    width: 150,
    height: 150,
  },
});
