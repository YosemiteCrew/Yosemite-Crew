import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Image,
  ImageSourcePropType,
  ImageStyle,
  Platform,
  PanResponder,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useTheme} from '@/hooks';

type LiquidGlassCardProps = React.ComponentProps<typeof LiquidGlassCard>;

type SpringConfig = Partial<Animated.SpringAnimationConfig> & {
  useNativeDriver: true;
};

export interface SwipeableGlassCardProps {
  actionIcon: ImageSourcePropType;
  onAction?: () => Promise<void> | void;
  onPress?: () => void;
  children: React.ReactNode;
  actionWidth?: number;
  actionBackgroundColor?: string;
  actionContainerStyle?: StyleProp<ViewStyle>;
  actionIconStyle?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  cardProps?: Omit<LiquidGlassCardProps, 'children'>;
  renderActionContent?: (close: () => void) => React.ReactNode;
  springConfig?: SpringConfig;
  actionOverlap?: number;
  enableHorizontalSwipeOnly?: boolean;
}

const DEFAULT_ACTION_WIDTH = 70;
const DEFAULT_SPRING: SpringConfig = {useNativeDriver: true};
const DEFAULT_OVERLAP = 0;

export const SwipeableGlassCard: React.FC<SwipeableGlassCardProps> = ({
  actionIcon,
  onAction,
  onPress,
  children,
  actionWidth = DEFAULT_ACTION_WIDTH,
  actionBackgroundColor,
  actionContainerStyle,
  actionIconStyle,
  containerStyle,
  cardProps,
  renderActionContent,
  springConfig,
  actionOverlap = DEFAULT_OVERLAP,
  enableHorizontalSwipeOnly = false,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const hasCustomActionContent = Boolean(renderActionContent);
  const translateX = useRef(new Animated.Value(0)).current;
  const currentOffset = useRef(0);
  const [isRevealed, setIsRevealed] = useState(false);

  const effectiveActionColor = actionBackgroundColor ?? theme.colors.success;
  const effectiveSpringConfig = useMemo<SpringConfig>(
    () => ({...DEFAULT_SPRING, ...springConfig}),
    [springConfig],
  );

  const swipeableWidth = actionWidth - actionOverlap;
  const actionContentOpacity = useMemo(() => {
    if (swipeableWidth <= 0) {
      return 0;
    }

    return translateX.interpolate({
      inputRange: [-swipeableWidth, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
  }, [swipeableWidth, translateX]);

  const clamp = useCallback(
    (dx: number) => Math.max(-swipeableWidth, Math.min(0, dx)),
    [swipeableWidth],
  );

  const animateTo = useCallback(
    (toValue: number, callback?: () => void) => {
      setIsRevealed(toValue < 0);
      currentOffset.current = toValue;
      Animated.spring(translateX, {
        ...effectiveSpringConfig,
        toValue,
      }).start(() => {
        callback?.();
      });
    },
    [effectiveSpringConfig, translateX],
  );

  const settleToNearest = useCallback(
    (dx = 0) => {
      const finalOffset = clamp(currentOffset.current + dx);
      const shouldOpen = finalOffset < -swipeableWidth / 2;
      animateTo(shouldOpen ? -swipeableWidth : 0);
    },
    [animateTo, clamp, swipeableWidth],
  );

  const panResponder = useMemo(() => {
    const handleMove = (_: any, gestureState: any) => {
      if (enableHorizontalSwipeOnly) {
        // Only allow horizontal movement if vertical movement is detected, prevent swipe
        if (Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) {
          return;
        }
      }
      const nextOffset = clamp(currentOffset.current + gestureState.dx);
      setIsRevealed(nextOffset < 0);
      translateX.setValue(nextOffset);
    };
    const handleRelease = (_: any, gestureState: any) => {
      const isMostlyVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);

      if (enableHorizontalSwipeOnly && isMostlyVertical) {
        if (Math.abs(gestureState.dx) < 8 && Math.abs(gestureState.dy) < 8) {
          onPress?.();
          return;
        }
        settleToNearest(gestureState.dx);
        return;
      }

      const isTap = Math.abs(gestureState.dx) < 8 && Math.abs(gestureState.dy) < 8;
      if (isTap) {
        animateTo(0, () => onPress?.());
        return;
      }

      settleToNearest(gestureState.dx);
    };

    return PanResponder.create({
      onPanResponderGrant: () => {
        // Stop any running animation and sync the offset so a new gesture does not jump
        translateX.stopAnimation(value => {
          currentOffset.current = value;
          setIsRevealed(value < 0);
          translateX.setValue(value);
        });
      },
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (enableHorizontalSwipeOnly) {
          return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
        }
        return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6;
      },
      onPanResponderMove: handleMove,
      onPanResponderRelease: handleRelease,
      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => {
        translateX.stopAnimation(value => {
          currentOffset.current = value;
          settleToNearest(0);
        });
      },
    });
  }, [
    animateTo,
    clamp,
    translateX,
    enableHorizontalSwipeOnly,
    onPress,
    settleToNearest,
  ]);

  const handleActionPress = () => {
    animateTo(0, () => {
      const result = onAction?.();
      if (result instanceof Promise) {
        result.catch(error => {
          console.warn('[SwipeableGlassCard] onAction rejected', error);
        });
      }
    });
  };

  const actionContent = renderActionContent ? (
    renderActionContent(() => animateTo(0))
  ) : (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.actionButton}
      onPress={handleActionPress}>
      <View style={styles.actionIconWrapper}>
        <Image
          source={actionIcon}
          style={[styles.actionImage, actionIconStyle]}
          resizeMode="contain"
        />
      </View>
    </TouchableOpacity>
  );

  const cardPropsWithReveal = useMemo(() => {
    const baseCardStyle =
      Platform.OS === 'android' ? styles.androidCardBase : undefined;
    const borderReset = Platform.OS === 'android' ? styles.androidBorderReset : undefined;
    const revealStyle = isRevealed ? styles.revealedCard : undefined;
    const mergedStyle = [
      baseCardStyle,
      cardProps?.style,
      borderReset,
      revealStyle,
    ].filter(Boolean);
    const mergedFallbackStyle = [
      baseCardStyle,
      cardProps?.fallbackStyle,
      borderReset,
      revealStyle,
    ].filter(Boolean);
    const resolvedShadow = cardProps?.shadow ?? 'base';

    if (!cardProps) {
      return {
        shadow: resolvedShadow,
        style: mergedStyle.length ? mergedStyle : undefined,
        fallbackStyle: mergedFallbackStyle.length ? mergedFallbackStyle : undefined,
      };
    }

    return {
      ...cardProps,
      shadow: resolvedShadow,
      style: mergedStyle.length ? mergedStyle : cardProps.style,
      fallbackStyle: mergedFallbackStyle.length
        ? mergedFallbackStyle
        : cardProps.fallbackStyle,
    };
  }, [
    cardProps,
    isRevealed,
    styles.androidCardBase,
    styles.androidBorderReset,
    styles.revealedCard,
  ]);

  const containerRevealStyle = isRevealed ? styles.revealedContainer : undefined;

  return (
    <View
      style={[
        styles.container,
        styles.shadowWrapper,
        containerRevealStyle,
        containerStyle,
      ]}>
      <Animated.View
        style={[
          styles.actionContainer,
          hasCustomActionContent && styles.customActionContainer,
          {
            width: actionWidth + actionOverlap,
            right: -actionOverlap,
            backgroundColor: effectiveActionColor,
            opacity: actionContentOpacity,
          },
          actionContainerStyle,
        ]}>
        <Animated.View
          style={[styles.actionContent, {opacity: actionContentOpacity}]}>
          {actionContent}
        </Animated.View>
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.animatedWrapper, {transform: [{translateX}]}]}>
        <LiquidGlassCard {...(cardPropsWithReveal ?? {})}>
          {children}
        </LiquidGlassCard>
      </Animated.View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      width: '100%',
      alignSelf: 'center',
      borderRadius: theme.borderRadius.lg,
      overflow: 'visible',
    },
    shadowWrapper: {
      backgroundColor: theme.colors.cardBackground,
      ...theme.shadows.md,
      shadowColor: theme.colors.neutralShadow,
    },
    revealedContainer: {
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    },
    actionContainer: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      borderTopRightRadius: theme.borderRadius.lg,
      borderBottomRightRadius: theme.borderRadius.lg,
      overflow: 'hidden',
      zIndex: 0,
    },
    customActionContainer: {
      alignItems: 'stretch',
    },
    actionButton: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionContent: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    actionIconWrapper: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionImage: {
      width: 30,
      height: 30,
    },
    animatedWrapper: {
      zIndex: 1,
      overflow: 'visible',
    },
    androidCardBase: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    androidBorderReset: {
      borderWidth: 0,
      borderColor: 'transparent',
    },
    revealedCard: {
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    },
  });

export default SwipeableGlassCard;
