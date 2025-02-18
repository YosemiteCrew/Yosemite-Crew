import {Dimensions, PixelRatio, StatusBar} from 'react-native';
const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;
const scaleFactor = windowWidth / 375;
const scaleHeightFactor = windowHeight / 812;
export const scaledValue = (value = 0) => value * scaleFactor;
export const scaledHeightValue = (value = 0) => value * scaleHeightFactor;

export const statusBarHeight = StatusBar.currentHeight;

// Reponsive Fonts
const fontScale = PixelRatio.getFontScale();
export const getFontSize = size => size / fontScale;
