import React, {useMemo, useCallback} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {scheduleOnRN} from 'react-native-worklets';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import type {Notification} from '../../types';
import {fonts} from '@/theme/typography';
import {normalizeImageUri} from '@/shared/utils/imageUri';

interface NotificationCardProps {
  notification: Notification;
  companion?: {name: string; profileImage?: string};
  onPress?: () => void;
  onDismiss?: () => void;
  onArchive?: () => void;
  swipeEnabled?: boolean;
}

export const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  companion,
  onPress,
  onDismiss,
  onArchive,
  swipeEnabled = true,
}) => {
  const {theme} = useTheme();
  const {width: screenWidth} = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const companionAvatarUri = useMemo(
    () => normalizeImageUri(companion?.profileImage ?? null),
    [companion?.profileImage],
  );

  const translateX = useSharedValue(0);
  const [isDragging, setIsDragging] = React.useState(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{translateX: translateX.value}],
  }));

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(swipeEnabled)
        .activeOffsetX([-5, 5])
        .onStart(() => {
          scheduleOnRN(setIsDragging, true);
        })
        .onUpdate(event => {
          translateX.value = event.translationX;
        })
        .onEnd(event => {
          const swipeThreshold = screenWidth * 0.25;

          if (event.translationX < -swipeThreshold) {
            translateX.value = withTiming(
              -screenWidth,
              {duration: 300},
              finished => {
                if (finished && onArchive) {
                  scheduleOnRN(onArchive);
                }
              },
            );
            return;
          }

          if (event.translationX > swipeThreshold) {
            translateX.value = withTiming(
              screenWidth,
              {duration: 300},
              finished => {
                if (finished && onDismiss) {
                  scheduleOnRN(onDismiss);
                }
              },
            );
            return;
          }

          translateX.value = withSpring(0);
        })
        .onFinalize(() => {
          scheduleOnRN(setIsDragging, false);
        }),
    [onArchive, onDismiss, screenWidth, swipeEnabled, translateX],
  );

  const formatTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const getIconFromImages = useCallback((iconKey: string) => {
    try {
      return Images[iconKey as keyof typeof Images];
    } catch {
      return Images.notificationIcon;
    }
  }, []);

  const avatarInitial = companion?.name?.charAt(0).toUpperCase() || 'P';

  return (
    <GestureDetector gesture={panGesture}>
      <Reanimated.View style={[styles.container, animatedStyle]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onPress}
          disabled={isDragging}
          style={styles.pressable}>
          <LiquidGlassCard
            glassEffect="none"
            interactive={false}
            shadow="none"
            style={styles.card}
            fallbackStyle={styles.cardFallback}>
            <View style={styles.content}>
              {/* Icon */}
              <View
                style={[
                  styles.iconContainer,
                  isDragging && styles.iconContainerDragging,
                ]}>
                <Image
                  source={getIconFromImages(notification.icon)}
                  style={styles.icon}
                  resizeMode="contain"
                />
              </View>

              {/* Main content */}
              <View style={styles.mainContent}>
                <Text style={styles.title} numberOfLines={2}>
                  {notification.title}
                </Text>
                {!!notification.description && (
                  <Text style={styles.description} numberOfLines={2}>
                    {notification.description}
                  </Text>
                )}
                <View style={styles.footer}>
                  <Text style={styles.time}>
                    {formatTime(notification.timestamp)}
                  </Text>
                </View>
              </View>

              {/* Avatar */}
              <View style={styles.avatarContainer}>
                {notification.avatarUrl && companionAvatarUri ? (
                  <Image
                    source={{uri: companionAvatarUri}}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>{avatarInitial}</Text>
                  </View>
                )}
              </View>
            </View>
          </LiquidGlassCard>
        </TouchableOpacity>
      </Reanimated.View>
    </GestureDetector>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      position: 'relative',
      marginBottom: theme.spacing['3'],
      overflow: 'hidden',
    },
    card: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing['3'],
      overflow: 'hidden',
    },
    cardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.border,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing['3'],
    },
    pressable: {
      flex: 1,
    },
    iconContainer: {
      width: theme.spacing['11'],
      height: theme.spacing['11'],
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    iconContainerDragging: {
      opacity: 0.7,
    },
    icon: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
    },
    mainContent: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    title: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
      flex: 1,
    },
    description: {
      ...theme.typography.bodyExtraSmall,
      color: theme.colors.placeholder,
      lineHeight: theme.typography.bodyExtraSmall.lineHeight,
      overflow: 'hidden',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      marginTop: theme.spacing['1'],
    },
    time: {
      fontFamily: fonts.SATOSHI_BOLD,
      fontSize: theme.typography.bodyExtraSmall.fontSize,
      lineHeight: theme.typography.bodyExtraSmall.fontSize * 1.2,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    avatarContainer: {
      flexShrink: 0,
    },
    avatar: {
      width: theme.spacing['8'],
      height: theme.spacing['8'],
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    avatarFallback: {
      backgroundColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.text,
    },
  });
