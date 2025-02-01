import {Image, StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {scaledValue} from '../../utils/design.utils';
import {Images} from '../../utils';
import LinearGradient from 'react-native-linear-gradient';

const LinearProgressBar = ({progress}) => {
  const totalWidth = scaledValue(248); // Total width of the progress bar container
  const imagePosition = (progress / 100) * totalWidth; // Dynamic position of the image based on progress

  return (
    <View style={styles.container}>
      <View style={styles.progressBarContainer}>
        <LinearGradient
          colors={['#1FC5CF', '#76CB9D', '#DCB568', '#E18041', '#DC4131']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.gradient} // Full width gradient
        />
      </View>
      <View style={[styles.imageContainer, {left: imagePosition}]}>
        <Image source={Images.Kizi} style={styles.image} resizeMode="contain" />
      </View>
    </View>
  );
};

export default LinearProgressBar;

const styles = StyleSheet.create({
  container: {},
  progressBarContainer: {
    height: scaledValue(4),
    width: scaledValue(248),
    backgroundColor: '#eee',
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  gradient: {
    height: '100%',
    width: '100%', // Full width of the progress bar container
    borderRadius: 2,
  },
  imageContainer: {
    position: 'absolute',
    top: scaledValue(-10), // Adjust to align image with the progress bar
    width: scaledValue(25.6), // Adjust width based on image size
    height: scaledValue(25.6), // Adjust height based on image size
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
