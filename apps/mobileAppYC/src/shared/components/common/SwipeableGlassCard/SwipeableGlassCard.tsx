import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  Image,
  ImageSourcePropType,
  ImageStyle,
  Platform,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {scheduleOnRN} from 'react-native-worklets';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type WithSpringConfig,
} from 'react-native-reanimated';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useTheme} from '@/hooks';

type LiquidGlassCardProps = React.ComponentProps<typeof LiquidGlassCard>;

type SpringConfig = {
  damping?: number;
  mass?: number;
  overshootClamping?: boolean;
  stiffness?: number;
  velocity?: number;
  useNativeDriver?: true;
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
const DEFAULT_SPRING: SpringConfig = {};
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
  const translateX = useSharedValue(0);
  const currentOffset = useSharedValue(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const isRevealedRef = useRef(false);

  const effectiveActionColor = actionBackgroundColor ?? theme.colors.success;
  const effectiveSpringConfig = useMemo<SpringConfig>(
    () => ({...DEFAULT_SPRING, ...springConfig}),
    [springConfig],
  );
  const reanimatedSpringConfig = useMemo<WithSpringConfig>(() => {
    const config = {...effectiveSpringConfig};
    delete config.useNativeDriver;
    return config as WithSpringConfig;
  }, [effectiveSpringConfig]);

  const swipeableWidth = actionWidth - actionOverlap;

  const updateRevealedState = useCallback((revealed: boolean) => {
    if (isRevealedRef.current === revealed) {
      return;
    }
    isRevealedRef.current = revealed;
    setIsRevealed(revealed);
  }, []);

  const animateTo = useCallback(
    (toValue: number, callback?: () => void) => {
      updateRevealedState(toValue < 0);
      currentOffset.value = toValue;
      translateX.value = withSpring(
        toValue,
        reanimatedSpringConfig,
        finished => {
          if (finished && callback) {
            scheduleOnRN(callback);
          }
        },
      );
    },
    [currentOffset, reanimatedSpringConfig, translateX, updateRevealedState],
  );

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX(enableHorizontalSwipeOnly ? [-10, 10] : [-6, 6])
      .onBegin(() => {
        currentOffset.value = translateX.value;
        scheduleOnRN(updateRevealedState, translateX.value < 0);
      })
      .onUpdate(event => {
        if (
          enableHorizontalSwipeOnly &&
          Math.abs(event.translationY) > Math.abs(event.translationX)
        ) {
          return;
        }

        const nextOffset = Math.max(
          -swipeableWidth,
          Math.min(0, currentOffset.value + event.translationX),
        );
        translateX.value = nextOffset;
        scheduleOnRN(updateRevealedState, nextOffset < 0);
      })
      .onEnd(event => {
        const isMostlyVertical =
          Math.abs(event.translationY) > Math.abs(event.translationX);
        const isTap =
          Math.abs(event.translationX) < 8 && Math.abs(event.translationY) < 8;

        if (enableHorizontalSwipeOnly && isMostlyVertical) {
          if (isTap && onPress) {
            scheduleOnRN(onPress);
          } else {
            const finalOffset = Math.max(
              -swipeableWidth,
              Math.min(0, currentOffset.value + event.translationX),
            );
            const shouldOpen = finalOffset < -swipeableWidth / 2;
            const nextOffset = shouldOpen ? -swipeableWidth : 0;
            currentOffset.value = nextOffset;
            scheduleOnRN(updateRevealedState, nextOffset < 0);
            translateX.value = withSpring(nextOffset, reanimatedSpringConfig);
          }
          return;
        }

        if (isTap) {
          currentOffset.value = 0;
          scheduleOnRN(updateRevealedState, false);
          translateX.value = withSpring(0, reanimatedSpringConfig, finished => {
            if (finished && onPress) {
              scheduleOnRN(onPress);
            }
          });
          return;
        }

        const finalOffset = Math.max(
          -swipeableWidth,
          Math.min(0, currentOffset.value + event.translationX),
        );
        const shouldOpen = finalOffset < -swipeableWidth / 2;
        const nextOffset = shouldOpen ? -swipeableWidth : 0;
        currentOffset.value = nextOffset;
        scheduleOnRN(updateRevealedState, nextOffset < 0);
        translateX.value = withSpring(nextOffset, reanimatedSpringConfig);
      })
      .onFinalize(() => {
        currentOffset.value = translateX.value;
      });

    if (enableHorizontalSwipeOnly) {
      pan.failOffsetY([-10, 10]);
    }

    return pan;
  }, [
    currentOffset,
    enableHorizontalSwipeOnly,
    onPress,
    reanimatedSpringConfig,
    swipeableWidth,
    translateX,
    updateRevealedState,
  ]);

  const animatedWrapperStyle = useAnimatedStyle(() => ({
    transform: [{translateX: translateX.value}],
  }));

  const actionOpacityStyle = useAnimatedStyle(() => {
    const opacity =
      swipeableWidth <= 0
        ? 0
        : Math.min(1, Math.max(0, Math.abs(translateX.value) / swipeableWidth));

    return {opacity};
  });

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
    const borderReset =
      Platform.OS === 'android' ? styles.androidBorderReset : undefined;
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
        fallbackStyle: mergedFallbackStyle.length
          ? mergedFallbackStyle
          : undefined,
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

  const containerRevealStyle = isRevealed
    ? styles.revealedContainer
    : undefined;

  return (
    <View
      style={[
        styles.container,
        styles.shadowWrapper,
        containerRevealStyle,
        containerStyle,
      ]}>
      <Reanimated.View
        style={[
          styles.actionContainer,
          hasCustomActionContent && styles.customActionContainer,
          {
            width: actionWidth + actionOverlap,
            right: -actionOverlap,
            backgroundColor: effectiveActionColor,
          },
          actionOpacityStyle,
          actionContainerStyle,
        ]}>
        <Reanimated.View style={[styles.actionContent, actionOpacityStyle]}>
          {actionContent}
        </Reanimated.View>
      </Reanimated.View>

      <GestureDetector gesture={gesture}>
        <Reanimated.View style={[styles.animatedWrapper, animatedWrapperStyle]}>
          <LiquidGlassCard {...(cardPropsWithReveal ?? {})}>
            {children}
          </LiquidGlassCard>
        </Reanimated.View>
      </GestureDetector>
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
      boxShadow: `0px 4px 6px ${theme.colors.neutralShadow}`,
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
