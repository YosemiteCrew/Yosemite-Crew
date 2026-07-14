import React, {useEffect} from 'react';
import {View, Text, StyleSheet, StatusBar} from 'react-native';
import {scheduleOnRN} from 'react-native-worklets';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import BootSplash from 'react-native-bootsplash';
import LinearGradient from 'react-native-linear-gradient';
import Video from 'react-native-video';
import {useReducedMotion} from '@/shared/components/common/Skeleton/useReducedMotion';

type Props = {
  onAnimationEnd: () => void;
};

const MAIN_LOGO = require('../../../../assets/splash/logo.png');
const SPLASH_VIDEO = require('../../../../assets/video/loop-dog.mp4');

// Warm-bone + over-video values (splash renders before the theme resolves).
const C = {
  screen: '#F7F3EC',
  inset: '#EAE2D5',
  ink: '#1D1C1B',
  inkMuted: '#5C5956',
  inkFaint2: '#A9A39E',
  pink: '#FF90D4',
  blue: '#257BED',
  hairline: '#E5DCCF',
  onVideo: '#F7F3EC',
};

// Cinematic scrim over the video: dark enough for the white lockup up top,
// fading to the warm screen at the bottom where the compliance pills sit.
const SCRIM_COLORS = [
  'rgba(29,28,27,0.42)',
  'rgba(29,28,27,0.14)',
  'rgba(29,28,27,0.06)',
  'rgba(29,28,27,0.12)',
  'rgba(29,28,27,0.32)',
  'rgba(29,28,27,0.46)',
  '#F7F3EC',
];
const SCRIM_LOCATIONS = [0, 0.14, 0.28, 0.44, 0.6, 0.74, 0.98];

const COMPLIANCE = [
  'AICPA SOC 2',
  'HL7 FHIR',
  'GDPR',
  'ISO 27001',
  'FDA 21 CFR Part 11',
];

const NEWSREADER = 'Newsreader-Regular';
const NEWSREADER_ITALIC = 'Newsreader-Italic';

const LOAD_TRACK_WIDTH = 122;
const LOAD_SEG_WIDTH = 48;

const CustomSplashScreen = ({onAnimationEnd}: Props) => {
  const fade = useSharedValue(1);
  const logoScale = useSharedValue(0.86);
  const loadX = useSharedValue(-LOAD_SEG_WIDTH);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    BootSplash.hide({fade: false});

    logoScale.value = withSpring(1, {damping: 13, stiffness: 120});
    loadX.value = withRepeat(
      withTiming(LOAD_TRACK_WIDTH, {
        duration: 1300,
        easing: Easing.bezier(0.45, 0.05, 0.55, 0.95),
      }),
      -1,
      false,
    );

    const exitTimer = setTimeout(() => {
      fade.value = withTiming(0, {duration: 700}, finished => {
        if (finished) {
          scheduleOnRN(onAnimationEnd);
        }
      });
    }, 3600);

    return () => {
      clearTimeout(exitTimer);
      cancelAnimation(fade);
      cancelAnimation(logoScale);
      cancelAnimation(loadX);
    };
  }, [fade, logoScale, loadX, onAnimationEnd]);

  const containerStyle = useAnimatedStyle(() => ({opacity: fade.value}));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{scale: logoScale.value}],
  }));
  const loadSegStyle = useAnimatedStyle(() => ({
    transform: [{translateX: loadX.value}],
  }));

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <Animated.View style={[styles.container, containerStyle]}>
        <Video
          source={SPLASH_VIDEO}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          repeat
          muted
          paused={reduceMotion}
          playInBackground={false}
          disableFocus
          ignoreSilentSwitch="obey"
        />
        <LinearGradient
          colors={SCRIM_COLORS}
          locations={SCRIM_LOCATIONS}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Brand lockup */}
        <View style={styles.center}>
          <Animated.Image
            source={MAIN_LOGO}
            style={[styles.logo, logoStyle]}
            resizeMode="contain"
          />
          <View style={styles.nameRow}>
            <Text style={styles.name}>Yosemite Crew</Text>
            <View style={styles.betaPill}>
              <Text style={styles.betaText}>BETA</Text>
            </View>
          </View>
          <Text style={styles.tagline}>Every companion has a story.</Text>
        </View>

        {/* Loader + compliance */}
        <View style={styles.bottom}>
          <View style={styles.loadTrack}>
            <Animated.View style={[styles.loadSeg, loadSegStyle]} />
          </View>
          <Text style={styles.compliantLabel}>Compliant &amp; secure</Text>
          <View style={styles.pillRow}>
            {COMPLIANCE.map(label => (
              <View key={label} testID="compliance-pill" style={styles.pill}>
                <Text style={styles.pillText}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.screen,
  },
  center: {
    position: 'absolute',
    top: '34%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  logo: {
    width: 102,
    height: 102,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 22,
  },
  name: {
    fontFamily: NEWSREADER,
    fontSize: 34,
    letterSpacing: -0.6,
    color: C.onVideo,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 22,
  },
  betaPill: {
    marginLeft: 11,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: 'rgba(29,28,27,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(247,243,236,0.28)',
    transform: [{translateY: -6}],
  },
  betaText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: C.pink,
  },
  tagline: {
    fontFamily: NEWSREADER_ITALIC,
    fontStyle: 'italic',
    fontSize: 17.5,
    letterSpacing: -0.1,
    color: C.pink,
    marginTop: 10,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 16,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 46,
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  loadTrack: {
    width: LOAD_TRACK_WIDTH,
    height: 4,
    borderRadius: 9999,
    backgroundColor: C.inset,
    overflow: 'hidden',
    marginBottom: 18,
  },
  loadSeg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: LOAD_SEG_WIDTH,
    height: 4,
    borderRadius: 9999,
    backgroundColor: C.blue,
  },
  compliantLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.inkFaint2,
    marginBottom: 13,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: C.screen,
    borderWidth: 1,
    borderColor: C.hairline,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.inkMuted,
  },
});

export default CustomSplashScreen;
