// AnimatedBottomTabBar.js
import React, {useEffect, useState} from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  Platform,
  Keyboard,
} from 'react-native';
import {scaledValue} from '../utils/design.utils';
// import {HorizontalLine} from '../utils/images.utils';
import {getFocusedRouteNameFromRoute} from '@react-navigation/native';

const AnimatedBottomTabBar = ({state, descriptors, navigation, route}) => {
  const translateX = new Animated.Value(0);

  const [showTabBar, setShowTabBar] = useState(true);
  const animateTabBar = index => {
    Animated.spring(translateX, {
      toValue: index * 100, // Adjust this value based on your tab bar item width
      useNativeDriver: true,
    }).start();
  };
  const [translateValue] = useState(new Animated.Value(0));
  const totalWidth = scaledValue(335);
  //   const tabWidth = totalWidth / state.routes.length;
  const tabWidth = scaledValue(64);
  useEffect(() => {
    animateTabBar(state.index);
  }, [state.index]);
  const animateSlider = index => {
    Animated.spring(translateValue, {
      toValue: index * tabWidth,
      velocity: 10,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    animateSlider(state.index);
  }, [state.index]);

  useEffect(() => {
    HideTab();
  }, [state.index, state.routes]);

  const HideTab = () => {
    const routes = state.routes[state.index];

    const routeName =
      getFocusedRouteNameFromRoute(routes) ||
      (routes.state && routes.state.routeNames[routes.state.index]) ||
      'Home';
    if (
      routeName === 'Home' ||
      routeName === 'Search' ||
      routeName === 'Spotlight' ||
      routeName === 'WishList' ||
      routeName === 'Profile'
    ) {
      setShowTabBar(true);
    } else {
      setShowTabBar(false);
    }
  };
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const translateY = new Animated.Value(0);
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow',
      () => {
        setKeyboardVisible(true);
        Animated.timing(translateY, {
          toValue: 100,
          duration: 0,
          useNativeDriver: true,
        }).start();
      },
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide',
      () => {
        setKeyboardVisible(false);
        animateTabBar(state.index);
      },
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [state.index, state.routes]);

  if (keyboardVisible) {
    return null; // Return null when the keyboard is open to hide the bottom tab bar
  }
  return (
    <>
      {showTabBar && (
        <View style={[style.tabContainer, {width: totalWidth}]}>
          <View style={{flexDirection: 'row'}}>
            <Animated.View
              style={[
                style.slider,
                {
                  transform: [{translateX: translateValue}],
                  width: tabWidth,
                  // backgroundColor: 'red',
                  alignItems: 'center',
                },
              ]}>
              {/* <Image
                source={HorizontalLine}
                style={{width: scaledValue(20), height: scaledValue(2)}}
              /> */}
            </Animated.View>

            {state.routes.map((route, index) => {
              const {options} = descriptors[route.key];

              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }

                animateSlider(index);
              };

              const onLongPress = () => {
                navigation.emit({
                  type: 'tabLongPress',
                  target: route.key,
                });
              };

              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityStates={isFocused ? ['selected'] : []}
                  accessibilityLabel={options.tabBarAccessibilityLabel}
                  testID={options.tabBarTestID}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={{flex: 1, alignItems: 'center'}}
                  key={index}>
                  {options.tabBarIcon &&
                    options.tabBarIcon({focused: isFocused})}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </>
  );
};

const style = StyleSheet.create({
  tabContainer: {
    position: 'absolute',
    bottom: scaledValue(34),
    height: scaledValue(72),
    borderRadius: scaledValue(48),
    backgroundColor: '#FFF',
    shadowColor: '#2E3E461A',
    shadowOffset: {
      width: 5,
      height: 5,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
    paddingBottom: 0,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  slider: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
  },
});

export default AnimatedBottomTabBar;
