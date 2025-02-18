import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Image} from 'react-native';
import {Images} from '../../utils';
import {scaledValue} from '../../utils/design.utils';

const CustomRating = ({maxRating = 5, size = 30, onRatingChange}) => {
  const [rating, setRating] = useState(0);

  const handleRatingPress = value => {
    setRating(value);
    if (onRatingChange) {
      onRatingChange(value);
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({length: maxRating}, (_, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => handleRatingPress(index + 1)}
          style={styles.starContainer}>
          {rating >= index + 1 ? (
            <Image
              source={Images.Star}
              style={{width: scaledValue(32), height: scaledValue(32)}}
            />
          ) : (
            <Image
              source={Images.StarUnFill}
              style={{width: scaledValue(32), height: scaledValue(32)}}
            />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  starContainer: {
    padding: 5,
  },
  star: {
    fontWeight: 'bold',
  },
});

export default CustomRating;
