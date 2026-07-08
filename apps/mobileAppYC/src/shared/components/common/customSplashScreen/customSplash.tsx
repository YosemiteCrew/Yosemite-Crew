import React, {useEffect} from 'react';
import {
  View,
  Image,
  useWindowDimensions,
  StyleSheet,
  StatusBar,
} from 'react-native';
import {scheduleOnRN} from 'react-native-worklets';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import BootSplash from 'react-native-bootsplash';
import LinearGradient from 'react-native-linear-gradient';

type Props = {
  onAnimationEnd: () => void;
};

const STAR_IMAGE = require('../../../../assets/splash/star1.png');
const MAIN_LOGO = require('../../../../assets/splash/logo.png');
const CERTIFICATION_LOGOS = [
  {id: 'soc', source: require('../../../../assets/splash/soc.png')},
  {id: 'fhir', source: require('../../../../assets/splash/fhir.png')},
  {id: 'gdpr', source: require('../../../../assets/splash/gdpr.png')},
  {id: 'iso', source: require('../../../../assets/splash/iso.png')},
  {id: 'fda', source: require('../../../../assets/splash/fda.png')},
];

const SplashStar = ({
  positionStyle,
  opacity,
  rotate,
  clockwise,
}: {
  positionStyle: {top: number; left?: number; right?: number};
  opacity: SharedValue<number>;
  rotate: SharedValue<number>;
  clockwise: boolean;
}) => {
  const starAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      {
        rotate: `${interpolate(
          rotate.value,
          [0, 1],
          [0, clockwise ? 360 : -360],
        )}deg`,
      },
    ],
  }));

  return (
    <Animated.View
      style={[styles.starContainer, positionStyle, starAnimatedStyle]}>
      <Image
        source={STAR_IMAGE}
        style={styles.starSmall}
        resizeMode="contain"
      />
    </Animated.View>
  );
};

const CustomSplashScreen = ({onAnimationEnd}: Props) => {
  const {width: screenWidth, height: screenHeight} = useWindowDimensions();
  const fadeAnim = useSharedValue(1);
  const scaleAnim = useSharedValue(0.8);
  const star1Anim = useSharedValue(1);
  const star2Anim = useSharedValue(1);
  const certAnim = useSharedValue(0);
  const star1RotateAnim = useSharedValue(0);
  const star2RotateAnim = useSharedValue(0);

  useEffect(() => {
    // Hide native splash immediately with no fade
    BootSplash.hide({fade: false});

    star1RotateAnim.value = withRepeat(
      withTiming(1, {duration: 4000, easing: Easing.linear}),
      -1,
      false,
    );

    star2RotateAnim.value = withRepeat(
      withTiming(1, {duration: 5000, easing: Easing.linear}),
      -1,
      false,
    );

    scaleAnim.value = withSpring(1, {damping: 12, stiffness: 120});
    certAnim.value = withDelay(600, withTiming(1, {duration: 800}));

    const floatingTimer = setTimeout(() => {
      star1Anim.value = withRepeat(
        withSequence(
          withTiming(0.6, {duration: 2500}),
          withTiming(1, {duration: 2500}),
        ),
        -1,
        false,
      );
      star2Anim.value = withRepeat(
        withSequence(
          withTiming(0.7, {duration: 3000}),
          withTiming(1, {duration: 3000}),
        ),
        -1,
        false,
      );
    }, 1500);

    const exitTimer = setTimeout(() => {
      fadeAnim.value = withTiming(0, {duration: 1000}, finished => {
        if (finished) {
          scheduleOnRN(onAnimationEnd);
        }
      });
      scaleAnim.value = withTiming(0.3, {duration: 1000});
      star1Anim.value = withTiming(0, {duration: 1000});
      star2Anim.value = withTiming(0, {duration: 1000});
      certAnim.value = withTiming(0, {duration: 1000});
    }, 4000);

    return () => {
      clearTimeout(floatingTimer);
      clearTimeout(exitTimer);
      cancelAnimation(fadeAnim);
      cancelAnimation(scaleAnim);
      cancelAnimation(star1Anim);
      cancelAnimation(star2Anim);
      cancelAnimation(certAnim);
      cancelAnimation(star1RotateAnim);
      cancelAnimation(star2RotateAnim);
    };
  }, [
    scaleAnim,
    star1Anim,
    star2Anim,
    certAnim,
    fadeAnim,
    star1RotateAnim,
    star2RotateAnim,
    onAnimationEnd,
  ]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scaleAnim.value}],
  }));

  const certificationsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: certAnim.value,
    transform: [
      {
        translateY: interpolate(certAnim.value, [0, 1], [30, 0]),
      },
    ],
  }));

  // Better random positions for stars
  const star1Position = {
    top: screenHeight * 0.3,
    left: screenWidth * 0.2,
  };

  const star2Position = {
    top: screenHeight * 0.7,
    right: screenWidth * 0.2,
  };

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <Animated.View style={[styles.container, containerAnimatedStyle]}>
        {/* Background Gradient - Fixed smooth gradient */}
        <LinearGradient
          colors={[
            '#87CEEB', // Light blue at top
            '#E6F3FF', // Sky blue
            '#F8FBFF', // Very light blue
            '#F8FBFF', // Almost white
            '#FFFFFF', // Pure white at bottom
          ]}
          locations={[0, 0.25, 0.5, 0.75, 1]}
          style={styles.gradient}
        />

        <SplashStar
          positionStyle={star1Position}
          opacity={star1Anim}
          rotate={star1RotateAnim}
          clockwise
        />
        <SplashStar
          positionStyle={star2Position}
          opacity={star2Anim}
          rotate={star2RotateAnim}
          clockwise={false}
        />

        {/* Main Logo - Center */}
        <View style={styles.logoContainer}>
          <Animated.View style={logoAnimatedStyle}>
            <Image
              source={MAIN_LOGO}
              style={styles.mainLogo}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Bottom Certifications Row */}
        <Animated.View
          style={[styles.certificationsContainer, certificationsAnimatedStyle]}>
          {CERTIFICATION_LOGOS.map(({id, source}) => (
            <View
              key={id}
              testID="certification-logo"
              style={styles.certificationWrapper}>
              <Image
                source={source}
                style={styles.certificationLogo}
                resizeMode="contain"
              />
            </View>
          ))}
        </Animated.View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  logoContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -88, // Half of logo width (176/2)
    marginTop: -88, // Half of logo height (176/2)
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainLogo: {
    width: 176,
    height: 176,
  },
  starContainer: {
    position: 'absolute',
    zIndex: 10,
  },
  starSmall: {
    width: 15,
    height: 15,
    opacity: 1,
  },
  certificationsContainer: {
    position: 'absolute',
    bottom: 64,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 100, // Ensure they appear on top
  },
  certificationWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 72,
    minHeight: 56,
  },
  certificationLogo: {
    width: 58,
    height: 42,
    opacity: 1, // Full opacity for real colors
  },
});

export default CustomSplashScreen;
