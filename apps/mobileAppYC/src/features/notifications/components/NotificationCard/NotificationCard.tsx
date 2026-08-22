import React, {useMemo, useCallback} from 'react';
import {View, Text, Image, StyleSheet, useWindowDimensions} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
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
import {
  IconTile,
  type IconTileTone,
} from '@/shared/components/common/IconTile/IconTile';
import type {Notification, NotificationCategory} from '../../types';
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

// Warm-bone tile tint per notification category.
const CATEGORY_TONE: Record<NotificationCategory, IconTileTone> = {
  all: 'neutral',
  messages: 'info',
  appointments: 'indigo',
  tasks: 'violet',
  documents: 'neutral',
  health: 'success',
  dietary: 'warning',
  hygiene: 'info',
  payment: 'success',
};

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
  const isUnread = notification.status === 'unread';

  return (
    <GestureDetector gesture={panGesture}>
      <Reanimated.View
        style={[
          styles.container,
          isUnread && styles.containerUnread,
          animatedStyle,
        ]}>
        <LiquidGlassCard
          glassEffect="none"
          interactive={false}
          shadow="none"
          style={styles.card}
          fallbackStyle={styles.cardFallback}>
          <PressableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            disabled={isDragging}
            style={styles.pressable}
            accessibilityRole="button"
            accessibilityLabel={notification.title}
            accessibilityState={{disabled: isDragging}}>
            <View style={styles.content}>
              {/* Icon */}
              <IconTile
                icon={getIconFromImages(notification.icon)}
                tone={CATEGORY_TONE[notification.category] ?? 'neutral'}
                size={theme.spacing['10']}
                iconSize={theme.spacing['4.5']}
                style={isDragging ? styles.iconDragging : undefined}
              />

              {/* Main content */}
              <View style={styles.mainContent}>
                <Text
                  style={[
                    styles.title,
                    isUnread ? styles.titleUnread : styles.titleRead,
                  ]}
                  numberOfLines={2}>
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

              {/* Avatar + unread accent */}
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
                {isUnread && <View style={styles.unreadDot} />}
              </View>
            </View>
          </PressableOpacity>

          {/* Visible alternative to the swipe gestures above, for keyboard/
              screen-reader users. Mirrors the same two actions swipe already
              performs, only when swipe itself is enabled for this list. */}
          {swipeEnabled && (onDismiss || onArchive) && (
            <View style={styles.actionRow}>
              {isUnread && onDismiss && (
                <PressableOpacity
                  style={styles.actionButton}
                  onPress={onDismiss}
                  accessibilityRole="button"
                  accessibilityLabel="Mark as read">
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={15}
                    color={theme.colors.inkFaint}
                  />
                  <Text style={styles.actionButtonText}>Mark as read</Text>
                </PressableOpacity>
              )}
              {onArchive && (
                <PressableOpacity
                  style={styles.actionButton}
                  onPress={onArchive}
                  accessibilityRole="button"
                  accessibilityLabel="Archive notification">
                  <Ionicons
                    name="archive-outline"
                    size={15}
                    color={theme.colors.inkFaint}
                  />
                  <Text style={styles.actionButtonText}>Archive</Text>
                </PressableOpacity>
              )}
            </View>
          )}
        </LiquidGlassCard>
      </Reanimated.View>
    </GestureDetector>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      position: 'relative',
      marginBottom: theme.spacing['3'],
      borderRadius: theme.borderRadius.cardSmall,
    },
    containerUnread: {
      ...theme.shadows.card,
    },
    card: {
      borderRadius: theme.borderRadius.cardSmall,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing['3.5'],
      overflow: 'hidden',
    },
    cardFallback: {
      borderRadius: theme.borderRadius.cardSmall,
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.hairline,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing['3'],
    },
    pressable: {
      flex: 1,
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.spacing['3'],
      marginTop: theme.spacing['2.5'],
      paddingTop: theme.spacing['2.5'],
      borderTopWidth: 1,
      borderTopColor: theme.colors.hairline,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['1'],
      paddingVertical: theme.spacing['1'],
      paddingHorizontal: theme.spacing['1.5'],
    },
    actionButtonText: {
      ...theme.typography.body12,
      color: theme.colors.inkMuted,
    },
    iconDragging: {
      opacity: 0.7,
    },
    mainContent: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    title: {
      ...theme.typography.labelSmall,
      color: theme.colors.inkBody,
      flex: 1,
    },
    titleUnread: {
      fontFamily: fonts.SATOSHI_BOLD,
      fontWeight: '700',
    },
    titleRead: {
      fontWeight: '600',
    },
    description: {
      ...theme.typography.bodyExtraSmall,
      color: theme.colors.inkMuted,
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
      ...theme.typography.body12,
      color: theme.colors.inkMuted,
    },
    avatarContainer: {
      flexShrink: 0,
      position: 'relative',
    },
    avatar: {
      width: theme.spacing['8'],
      height: theme.spacing['8'],
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
    },
    avatarFallback: {
      backgroundColor: theme.colors.screen2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.inkBody,
    },
    unreadDot: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: theme.spacing['2'],
      height: theme.spacing['2'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.pink,
      borderWidth: 2,
      borderColor: theme.colors.cardBackground,
    },
  });
