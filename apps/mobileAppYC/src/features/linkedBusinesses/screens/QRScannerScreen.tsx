import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSelector} from 'react-redux';
import {useTheme} from '@/hooks';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {selectLinkedBusinessesLoading} from '../selectors';
import type {LinkedBusinessStackParamList} from '@/navigation/types';

import {colors} from '@/theme';
type Props = NativeStackScreenProps<LinkedBusinessStackParamList, 'QRScanner'>;

// Bespoke dark camera palette - the QR scanner intentionally breaks the light
// warm-bone token surface for a viewfinder that reads as a live camera feed.
const CAMERA = {
  frame: '#17130F',
  feedTop: '#2C241C',
  feedMid: '#1A1512',
  feedBottom: '#100D0A',
  glow: 'rgba(58, 47, 36, 0.55)',
  ink: colors.textDark,
  inkMuted: 'rgba(244, 239, 230, 0.6)',
  inkFaint: 'rgba(244, 239, 230, 0.45)',
  glass: 'rgba(244, 239, 230, 0.12)',
  glassBorder: 'rgba(244, 239, 230, 0.16)',
} as const;

// Faint decorative QR hint (6x6) so the viewfinder reads as a code in view.
const QR_HINT: readonly number[][] = [
  [1, 1, 1, 0, 1, 1],
  [1, 0, 1, 1, 0, 1],
  [1, 1, 0, 1, 1, 0],
  [0, 1, 1, 0, 1, 1],
  [1, 0, 1, 1, 0, 1],
  [1, 1, 0, 1, 1, 1],
];

const SCAN_LINE_HEIGHT = 3;

export const QRScannerScreen: React.FC<Props> = ({route, navigation}) => {
  const {theme} = useTheme();
  const {width} = useWindowDimensions();
  const frameSize = Math.min(248, width - 96);
  const styles = useMemo(
    () => createStyles(theme, frameSize),
    [theme, frameSize],
  );
  useSelector(selectLinkedBusinessesLoading);

  const [torchOn, setTorchOn] = useState(false);

  const petName = route.params?.companionName?.trim();
  const subtitle = petName
    ? `Linking shares ${petName}'s record with this practice after you confirm.`
    : "Linking shares your companion's record with this practice after you confirm.";

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleToggleTorch = useCallback(() => {
    setTorchOn(prev => !prev);
  }, []);

  // Manual escape hatch: drop to the business search flow to find the practice
  // by hand when the code can't be scanned. Camera scan integration
  // (react-native-vision-camera) will call the same link flow when wired.
  const handleManualEntry = useCallback(() => {
    navigation.navigate('BusinessSearch', route.params);
  }, [navigation, route.params]);

  const reducedMotion = useReducedMotion();
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      sweep.value = 0.5;
      return;
    }
    sweep.value = withRepeat(
      withTiming(1, {duration: 2200, easing: Easing.linear}),
      -1,
      true,
    );
  }, [reducedMotion, sweep]);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{translateY: sweep.value * (frameSize - SCAN_LINE_HEIGHT)}],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Faux camera feed */}
      <LinearGradient
        colors={[CAMERA.feedTop, CAMERA.feedMid, CAMERA.feedBottom]}
        locations={[0, 0.55, 1]}
        start={{x: 0.5, y: 0}}
        end={{x: 0.5, y: 1}}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.feedGlow} pointerEvents="none" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header / chrome */}
        <View style={styles.header}>
          <PressableOpacity
            style={styles.glassCircle}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
            testID="qr-scanner-close">
            <Icon name="close" size={20} color={CAMERA.ink} />
          </PressableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            Scan clinic code
          </Text>

          <PressableOpacity
            style={styles.glassCircle}
            onPress={handleToggleTorch}
            accessibilityRole="button"
            accessibilityState={{selected: torchOn}}
            accessibilityLabel={
              torchOn ? 'Turn off flashlight' : 'Turn on flashlight'
            }
            testID="qr-scanner-torch">
            <Icon
              name={torchOn ? 'flashlight' : 'flashlight-outline'}
              size={19}
              color={CAMERA.ink}
            />
          </PressableOpacity>
        </View>

        {/* Viewfinder */}
        <View style={styles.viewfinder}>
          <View style={styles.scanFrame}>
            <View style={styles.qrHint} pointerEvents="none">
              {QR_HINT.map((row, r) => (
                <View key={`qr-row-${r}`} style={styles.qrRow}>
                  {row.map((cell, c) => (
                    <View
                      key={`qr-cell-${r}-${c}`}
                      style={[styles.qrCell, cell === 1 && styles.qrCellOn]}
                    />
                  ))}
                </View>
              ))}
            </View>

            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />

            <Animated.View style={[styles.scanLine, scanLineStyle]}>
              <LinearGradient
                colors={[
                  'rgba(92, 225, 230, 0)',
                  theme.colors.cyan,
                  'rgba(92, 225, 230, 0)',
                ]}
                start={{x: 0, y: 0.5}}
                end={{x: 1, y: 0.5}}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>

          <View style={styles.caption}>
            <Text style={styles.captionTitle}>
              Point at the code on the front desk
            </Text>
            <Text style={styles.captionSub}>{subtitle}</Text>
          </View>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottom}>
          <PressableOpacity
            style={styles.manualButton}
            onPress={handleManualEntry}
            accessibilityRole="button"
            accessibilityLabel="Enter code manually"
            testID="qr-scanner-manual-entry">
            <Icon name="keypad-outline" size={18} color={CAMERA.ink} />
            <Text style={styles.manualButtonText}>Enter code manually</Text>
          </PressableOpacity>

          <Text style={styles.formatHint}>Codes look like YC-ALPN-2043</Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (theme: any, frameSize: number) => {
  const cornerSize = 40;
  const cornerRadius = 22;
  const cornerBorder = 3.5;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: CAMERA.frame,
    },
    feedGlow: {
      position: 'absolute',
      top: -frameSize * 0.4,
      alignSelf: 'center',
      width: frameSize * 2.2,
      height: frameSize * 2.2,
      borderRadius: frameSize * 1.1,
      backgroundColor: CAMERA.glow,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['3'],
      gap: theme.spacing['3'],
    },
    glassCircle: {
      width: theme.spacing['10'],
      height: theme.spacing['10'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: CAMERA.glass,
      borderWidth: 1,
      borderColor: CAMERA.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      ...theme.typography.mobileBodyEmphasis,
      fontWeight: '600',
      color: CAMERA.ink,
    },
    viewfinder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['8'],
    },
    scanFrame: {
      width: frameSize,
      height: frameSize,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qrHint: {
      position: 'absolute',
      width: frameSize * 0.52,
      height: frameSize * 0.52,
      opacity: 0.28,
      justifyContent: 'space-between',
    },
    qrRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      flex: 1,
    },
    qrCell: {
      flex: 1,
      margin: 1.5,
      borderRadius: 2,
      backgroundColor: 'transparent',
    },
    qrCellOn: {
      backgroundColor: CAMERA.ink,
    },
    corner: {
      position: 'absolute',
      width: cornerSize,
      height: cornerSize,
      borderColor: CAMERA.ink,
    },
    cornerTopLeft: {
      top: 0,
      left: 0,
      borderTopWidth: cornerBorder,
      borderLeftWidth: cornerBorder,
      borderTopLeftRadius: cornerRadius,
    },
    cornerTopRight: {
      top: 0,
      right: 0,
      borderTopWidth: cornerBorder,
      borderRightWidth: cornerBorder,
      borderTopRightRadius: cornerRadius,
    },
    cornerBottomLeft: {
      bottom: 0,
      left: 0,
      borderBottomWidth: cornerBorder,
      borderLeftWidth: cornerBorder,
      borderBottomLeftRadius: cornerRadius,
    },
    cornerBottomRight: {
      bottom: 0,
      right: 0,
      borderBottomWidth: cornerBorder,
      borderRightWidth: cornerBorder,
      borderBottomRightRadius: cornerRadius,
    },
    scanLine: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: SCAN_LINE_HEIGHT,
      boxShadow: '0px 0px 18px rgba(92, 225, 230, 0.6)',
    },
    caption: {
      alignItems: 'center',
      gap: theme.spacing['2'],
      paddingHorizontal: theme.spacing['10'],
    },
    captionTitle: {
      ...theme.typography.bodyMedium,
      fontFamily: theme.typography.SATOSHI_BOLD,
      fontSize: 15.5,
      fontWeight: '600',
      color: CAMERA.ink,
      textAlign: 'center',
    },
    captionSub: {
      ...theme.typography.body13,
      color: CAMERA.inkMuted,
      textAlign: 'center',
    },
    bottom: {
      paddingHorizontal: theme.spacing['5'],
    },
    manualButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['2'],
      height: 52,
      borderRadius: theme.borderRadius.button,
      backgroundColor: CAMERA.glass,
      borderWidth: 1,
      borderColor: CAMERA.glassBorder,
      marginBottom: theme.spacing['3.5'],
    },
    manualButtonText: {
      ...theme.typography.bodyMedium,
      fontSize: 15,
      color: CAMERA.ink,
    },
    formatHint: {
      ...theme.typography.bodyExtraSmall,
      color: CAMERA.inkFaint,
      textAlign: 'center',
      paddingBottom: theme.spacing['4'],
    },
  });
};
