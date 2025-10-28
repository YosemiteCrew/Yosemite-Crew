import React, {useCallback, useMemo, useRef} from 'react';
import {
  Animated,
  Image,
  ImageSourcePropType,
  ImageStyle,
  PanResponder,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {LiquidGlassCard} from '@/components/common/LiquidGlassCard/LiquidGlassCard';
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
const DEFAULT_OVERLAP = 12; // Default overlap to hide the seam

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

  const effectiveActionColor = actionBackgroundColor ?? theme.colors.success;
  const effectiveSpringConfig = useMemo<SpringConfig>(
    () => ({...DEFAULT_SPRING, ...springConfig}),
    [springConfig],
  );

    const swipeableWidth = actionWidth - actionOverlap;

  const clamp = useCallback(
    (dx: number) => Math.max(-swipeableWidth, Math.min(0, dx)),
    [swipeableWidth],
  );

  const animateTo = useCallback(
    (toValue: number, callback?: () => void) => {
      Animated.spring(translateX, {
        ...effectiveSpringConfig,
        toValue,
      }).start(() => callback?.());
    },
    [effectiveSpringConfig, translateX],
  );

  const panResponder = useMemo(() => {
    const handleMove = (_: any, gestureState: any) => {
      if (enableHorizontalSwipeOnly) {
        // Only allow horizontal movement if vertical movement is detected, prevent swipe
        if (Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) {
          return;
        }
      }
      translateX.setValue(clamp(gestureState.dx));
    };
    const handleRelease = (_: any, gestureState: any) => {
      const isMostlyVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);

      if (enableHorizontalSwipeOnly && isMostlyVertical) {
        if (Math.abs(gestureState.dx) < 8 && Math.abs(gestureState.dy) < 8) {
          onPress?.();
        }
        return;
      }

      const isTap = Math.abs(gestureState.dx) < 8 && Math.abs(gestureState.dy) < 8;
      if (isTap) {
        animateTo(0, () => onPress?.());
        return;
      }

      const shouldOpen = gestureState.dx < -swipeableWidth / 2;
      animateTo(shouldOpen ? -swipeableWidth : 0);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (enableHorizontalSwipeOnly) {
          return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
        }
        return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6;
      },
      onPanResponderMove: handleMove,
      onPanResponderRelease: handleRelease,
    });
  }, [swipeableWidth, animateTo, clamp, translateX, enableHorizontalSwipeOnly, onPress]);

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

  return (
    <View style={[styles.container, containerStyle]}>
      <View
        style={[
          styles.actionContainer,
          hasCustomActionContent && styles.customActionContainer,
          {width: actionWidth + actionOverlap, right: -actionOverlap, backgroundColor: effectiveActionColor},
          actionContainerStyle,
        ]}>
        {renderActionContent ? (
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
        )}
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.animatedWrapper, {transform: [{translateX}]}]}>
        <LiquidGlassCard {...cardProps}>{children}</LiquidGlassCard>
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
      overflow: 'hidden',
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
    animatedWrapper: {zIndex: 1},
  });

export default SwipeableGlassCard;
