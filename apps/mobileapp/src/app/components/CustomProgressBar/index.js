import {StyleSheet, View} from 'react-native';
import React from 'react';
import {scaledValue} from '../../utils/design.utils';

const CustomProgressBar = ({percentage, customWidth = 295}) => {
  // Calculate the filled and remaining width based on the percentage
  const filledWidth = (customWidth * percentage) / 100;
  const remainingWidth = customWidth - filledWidth;

  return (
    <View
      style={[styles.progressBarContainer, {width: scaledValue(customWidth)}]}>
      {/* Filled part */}
      <View style={[styles.filledBar, {width: filledWidth}]} />
      {/* Remaining part */}
      <View style={[styles.remainingBar, {width: remainingWidth}]} />
    </View>
  );
};

export default CustomProgressBar;

const styles = StyleSheet.create({
  progressBarContainer: {
    height: scaledValue(2), // Adjust the height of the progress bar as needed
    flexDirection: 'row', // Aligns the filled and remaining bars horizontally
    borderRadius: scaledValue(8),
  },
  filledBar: {
    height: '100%',
    backgroundColor: 'red', // Red color for the filled part
    borderRadius: scaledValue(8),
  },
  remainingBar: {
    height: '100%',
    backgroundColor: '#aaa', // Blue color for the remaining part
    borderRadius: scaledValue(8),
  },
});
