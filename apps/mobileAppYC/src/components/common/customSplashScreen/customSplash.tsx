import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  Animated,
  Dimensions,
  StyleSheet,
  StatusBar,
} from 'react-native';
import BootSplash from 'react-native-bootsplash';
import LinearGradient from 'react-native-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type Props = {
  onAnimationEnd: () => void;
};

const CustomSplashScreen = ({ onAnimationEnd }: Props) => {
  const [fadeAnim] = useState(() => new Animated.Value(1));
  const [scaleAnim] = useState(() => new Animated.Value(0.8));
  const [star1Anim] = useState(() => new Animated.Value(1)); // Start visible
  const [star2Anim] = useState(() => new Animated.Value(1)); // Start visible
  const [certAnim] = useState(() => new Animated.Value(0));
  const [star1RotateAnim] = useState(() => new Animated.Value(0)); // For rotation
  const [star2RotateAnim] = useState(() => new Animated.Value(0)); // For rotation

  useEffect(() => {
    // Hide native splash immediately with no fade
    BootSplash.hide({ fade: false });

    // Start star rotations immediately from the beginning
    const star1Rotation = Animated.loop(
      Animated.timing(star1RotateAnim, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      })
    );

    const star2Rotation = Animated.loop(
      Animated.timing(star2RotateAnim, {
        toValue: 1,
        duration: 5000,
        useNativeDriver: true,
      })
    );

    // Start rotations immediately
    star1Rotation.start();
    star2Rotation.start();

    // Entrance animations - no fade in for stars, they start visible
    const entranceAnimations = Animated.sequence([
      // Logo scale in first
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      // Certifications fade in only
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(certAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ]);

    entranceAnimations.start();

    // Add floating opacity animation for stars after entrance
    const startFloatingAnimation = () => {
      const star1Float = Animated.loop(
        Animated.sequence([
          Animated.timing(star1Anim, {
            toValue: 0.6,
            duration: 2500,
            useNativeDriver: true,
          }),
          Animated.timing(star1Anim, {
            toValue: 1,
            duration: 2500,
            useNativeDriver: true,
          }),
        ])
      );

      const star2Float = Animated.loop(
        Animated.sequence([
          Animated.timing(star2Anim, {
            toValue: 0.7,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(star2Anim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
        ])
      );

      star1Float.start();
      star2Float.start();
    };

    // Start floating after entrance animations complete
    setTimeout(startFloatingAnimation, 1500);

    // Show custom splash for 4 seconds total, then exit
    const exitTimer = setTimeout(() => {
      // Start the exit animation for our custom splash
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        // Stars fade out during exit
        Animated.timing(star1Anim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(star2Anim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(certAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onAnimationEnd();
      });
    }, 4000);

    return () => {
      clearTimeout(exitTimer);
    };
  }, [scaleAnim, star1Anim, star2Anim, certAnim, fadeAnim, star1RotateAnim, star2RotateAnim, onAnimationEnd]);

  // Better random positions for stars
  const star1Position = {
    top: screenHeight * 0.3,
    left: screenWidth * 0.2,
  };

  const star2Position = {
    top: screenHeight * 0.6,
    right: screenWidth * 0.2,
  };

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
          },
        ]}
      >
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

        {/* Star 1 - Small, positioned */}
        <Animated.View
          style={[
            styles.starContainer,
            star1Position,
            {
              opacity: star1Anim, // Starts at 1, only fades out
              transform: [
                {
                  rotate: star1RotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <Image
            source={require('../../../assets/splash/star1.png')}
            style={styles.starSmall}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Star 2 - Small, positioned */}
        <Animated.View
          style={[
            styles.starContainer,
            star2Position,
            {
              opacity: star2Anim, // Starts at 1, only fades out
              transform: [
                {
                  rotate: star2RotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '-360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <Image
            source={require('../../../assets/splash/star1.png')}
            style={styles.starSmall}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Main Logo - Center */}
        <View style={styles.logoContainer}>
          <Animated.View
            style={{
              transform: [{ scale: scaleAnim }],
            }}
          >
            <Image
              source={require('../../../assets/splash/logo.png')} // Your main logo
              style={styles.mainLogo}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Bottom Certifications Row */}
        <Animated.View
          style={[
            styles.certificationsContainer,
            {
              opacity: certAnim,
              transform: [
                {
                  translateY: certAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.certificationWrapper}>
            <Image
              source={require('../../../assets/splash/soc.png')}
              style={styles.certificationLogo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.certificationWrapper}>
            <Image
              source={require('../../../assets/splash/fhir.png')}
              style={styles.certificationLogo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.certificationWrapper}>
            <Image
              source={require('../../../assets/splash/gdpr.png')}
              style={styles.certificationLogo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.certificationWrapper}>
            <Image
              source={require('../../../assets/splash/iso.png')}
              style={styles.certificationLogo}
              resizeMode="contain"
            />
          </View>
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
    top: '40%',
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
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 25,
    zIndex: 100, // Ensure they appear on top
  },
  certificationWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    minWidth: 75,
    minHeight: 60,
  },
  certificationLogo: {
    width: 65,
    height: 48,
    opacity: 1, // Full opacity for real colors
  },
});

export default CustomSplashScreen;