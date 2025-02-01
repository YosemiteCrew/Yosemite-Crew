import {View} from 'react-native';
import React, {useRef, useState} from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Swiper from 'react-native-swiper';
import FirstSwipe from './FirstSwipe';
import SecondSwipe from './SecondSwipe';
import ThirdSwipe from './ThirdSwipe';
import ForthSwipe from './ForthSwipe';
import {setOnBoarding} from '../../../redux/slices/authSlice';

const OnBoarding = () => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const [index, setIndex] = useState(0);
  const swiperRef = useRef();
  const handleIndexChanged = newIndex => {
    setIndex(newIndex);
  };
  return (
    <View
      style={{
        flex: 1,
      }}>
      <Swiper
        ref={swiperRef}
        loop={false}
        onIndexChanged={handleIndexChanged}
        activeDotColor="rgba(3, 165, 190, 1)"
        dotColor="#E9E9E9"
        showsButtons={false}
        activeDotStyle={{
          backgroundColor: 'transparent',
        }}
        dotStyle={{
          backgroundColor: 'transparent',
        }}>
        <FirstSwipe />
        <SecondSwipe />
        <ThirdSwipe />
        <ForthSwipe />
      </Swiper>
    </View>
  );
};

export default OnBoarding;
