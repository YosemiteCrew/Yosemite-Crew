import React from 'react';
import {ImageBackground, StyleSheet} from 'react-native';
import FastImage from 'react-native-fast-image';
import {IMAGE_CLOUD_URL} from '../../constants';
import {scaledValue} from '../../utils/design.utils';
import {defaultImage} from '../../utils/Images';

const GImage = ({
  image,
  resizeMode,
  style,
  directUrl,
  backgroundMode,
  fullImageStyle,
  content,
  borderRadius,
}) => {
  const imageSource = image
    ? {
        uri: directUrl ? image || image?.uri : IMAGE_CLOUD_URL + image,
        priority: FastImage.priority.high,
        cache: FastImage.cacheControl.immutable, // Use `immutable` for better caching
      }
    : defaultImage;

  return (
    <>
      {backgroundMode ? (
        <ImageBackground
          borderRadius={borderRadius}
          source={imageSource}
          defaultSource={defaultImage}
          resizeMode={resizeMode || 'cover'}
          style={[styles.imageStyle, fullImageStyle]}>
          {typeof content === 'function' ? content() : null}
        </ImageBackground>
      ) : (
        <FastImage
          source={imageSource}
          defaultSource={defaultImage}
          resizeMode={resizeMode || FastImage.resizeMode.cover}
          style={[styles.imageStyle, style]}
        />
      )}
    </>
  );
};

export default GImage;

const styles = StyleSheet.create({
  imageStyle: {
    width: scaledValue(74),
    height: scaledValue(74),
  },
});
