import React, {useEffect, useState} from 'react';
import {ImageBackground, StyleSheet} from 'react-native';
import FastImage from 'react-native-fast-image';
import AWS from 'aws-sdk';
import {
  AWS_S3_BUCKET,
  AWS_S3_KEY,
  AWS_S3_REGION,
  AWS_S3_SECRET,
} from '../../constants';
import {scaledValue} from '../../utils/design.utils';
import {defaultImage} from '../../utils/Images';
import {colors} from '../../../assets/colors';

// Initialize AWS S3 instance
const s3 = new AWS.S3({
  accessKeyId: AWS_S3_KEY,
  secretAccessKey: AWS_S3_SECRET,
  region: AWS_S3_REGION,
});

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
  const [profileIcon, setProfileIcon] = useState('');

  useEffect(() => {
    const fetchImageUrl = async () => {
      if (!image) {
        setProfileIcon('');
      } else if (!directUrl) {
        try {
          const signedUrl = await s3.getSignedUrlPromise('getObject', {
            Bucket: AWS_S3_BUCKET,
            Key: image,
            Expires: 120, // 2 minutes expiration
          });
          setProfileIcon(signedUrl);
        } catch (error) {
          console.error('Error generating signed URL:', error);
          setProfileIcon(''); // Fallback in case of error
        }
      } else {
        setProfileIcon(image);
      }
    };

    fetchImageUrl();
  }, [image, directUrl]);

  const imageSource = image
    ? {
        uri: directUrl ? image : profileIcon,
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
    // backgroundColor: colors.black,
    // Uncomment below if you need rounded corners
    // borderRadius: scaledValue(10),
  },
});
