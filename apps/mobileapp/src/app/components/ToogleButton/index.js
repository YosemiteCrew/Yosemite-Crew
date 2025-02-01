import {Animated, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import React from 'react';
import {scaledValue} from '../../utils/design.utils';
import {colors} from '../../../assets/colors';

const ToggleButton = ({
  toggleState,
  setToggleState,
  width,
  height,
  circleWidth,
  outRange,
  onPress,
}) => {
  const toggleAnimation = new Animated.Value(toggleState ? 1 : 0);

  const toggleSwitch = () => {
    const newState = !toggleState;
    setToggleState(newState);
    Animated.timing(toggleAnimation, {
      toValue: newState ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const transformStyle = {
    transform: [
      {
        translateX: toggleAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, outRange ? outRange : 18], // Adjust this value based on your toggle button width
        }),
      },
    ],
  };
  return (
    <View style={styles.mainView(width)}>
      <TouchableOpacity
        onPress={onPress ? onPress : toggleSwitch}
        activeOpacity={1}>
        <View
          style={[
            styles.containers(width, height),
            toggleState ? styles.activeContainer : styles.inactiveContainer,
          ]}>
          <View style={styles.toggleInnerView(toggleState, circleWidth)}>
            <Animated.View
              style={[styles.toggleCircle(circleWidth), transformStyle]}
            />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default ToggleButton;

const styles = StyleSheet.create({
  containers: (width, height) => ({
    width: width ? scaledValue(width) : scaledValue(43),
    height: height ? scaledValue(height) : scaledValue(27),
    borderRadius: 20,
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: scaledValue(3),
  }),
  toggleCircle: circleWidth => ({
    width: circleWidth ? scaledValue(circleWidth) : scaledValue(20),
    height: circleWidth ? scaledValue(circleWidth) : scaledValue(20),
    borderRadius: scaledValue(15),
    backgroundColor: '#fff',
    position: 'absolute',
    top: 0,
    left: 0,
  }),
  activeContainer: {
    backgroundColor: colors.fawn,
  },
  inactiveContainer: {
    backgroundColor: colors.borderColor,
  },
  mainView: width => ({
    alignItems: 'center',
    backgroundColor: colors.borderColor,
    width: width ? scaledValue(width) : scaledValue(43),
    borderRadius: scaledValue(15),
  }),
  toggleInnerView: (toggleState, circleWidth) => ({
    width: circleWidth ? scaledValue(circleWidth) : scaledValue(20),
    height: circleWidth ? scaledValue(circleWidth) : scaledValue(20),
    borderRadius: scaledValue(15),
    backgroundColor: !toggleState ? '#fff' : colors.fawn,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'flex-start',
  }),
});
