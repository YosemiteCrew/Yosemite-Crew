import React, {useMemo, useCallback} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import type {Notification} from '../../types';

interface NotificationCardProps {
  notification: Notification;
  companion?: {name: string; profileImage?: string};
  onPress?: () => void;
  onDismiss?: () => void;
  onArchive?: () => void;
  showActions?: boolean;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

export const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  companion,
  onPress,
  onDismiss,
  onArchive,
  showActions = true,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const pan = React.useRef(new Animated.ValueXY()).current;
  const [isDragging, setIsDragging] = React.useState(false);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const {dx} = gestureState;
        return Math.abs(dx) > 5;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
      },
      onPanResponderMove: Animated.event([null, {dx: pan.x}], {useNativeDriver: false}),
      onPanResponderRelease: (evt, gestureState) => {
        const {dx} = gestureState;

        if (dx < -SWIPE_THRESHOLD) {
          // Swipe left - archive
          Animated.timing(pan.x, {
            toValue: -SCREEN_WIDTH,
            duration: 300,
            useNativeDriver: false,
          }).start(() => {
            onArchive?.();
          });
        } else if (dx > SWIPE_THRESHOLD) {
          // Swipe right - dismiss
          Animated.timing(pan.x, {
            toValue: SCREEN_WIDTH,
            duration: 300,
            useNativeDriver: false,
          }).start(() => {
            onDismiss?.();
          });
        } else {
          // Snap back
          Animated.spring(pan, {
            toValue: {x: 0, y: 0},
            useNativeDriver: false,
          }).start();
        }
        setIsDragging(false);
      },
    }),
  ).current;

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

    return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
  }, []);

  const getPriorityColor = useCallback(() => {
    switch (notification.priority) {
      case 'urgent':
        return theme.colors.error;
      case 'high':
        return theme.colors.warning;
      case 'medium':
        return theme.colors.primary;
      case 'low':
        return theme.colors.textSecondary;
      default:
        return theme.colors.primary;
    }
  }, [notification.priority, theme.colors]);

  const getIconFromImages = useCallback((iconKey: string) => {
    try {
      return Images[iconKey as keyof typeof Images];
    } catch {
      return Images.notificationIcon;
    }
  }, []);

  const avatarInitial = companion?.name?.charAt(0).toUpperCase() || 'P';

  const animatedStyle = {
    transform: [{translateX: pan.x}],
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]} {...panResponder.panHandlers}>
      {/* Background action indicators */}
      <View style={styles.dismissBackgroundLeft}>
        <Text style={styles.actionText}>Dismiss</Text>
      </View>
      <View style={styles.archiveBackgroundRight}>
        <Text style={styles.actionText}>Archive</Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        disabled={isDragging}
        style={{flex: 1}}>
        <LiquidGlassCard
          glassEffect="clear"
          interactive
          shadow={notification.status === 'unread' ? 'md' : 'sm'}
          style={styles.card}
          fallbackStyle={styles.cardFallback}>
          <View style={styles.content}>
            {/* Icon */}
            <View
              style={[
                styles.iconContainer,
                {borderColor: getPriorityColor(), opacity: isDragging ? 0.7 : 1},
              ]}>
              <Image
                source={getIconFromImages(notification.icon)}
                style={styles.icon}
                resizeMode="contain"
              />
            </View>

            {/* Main content */}
            <View style={styles.mainContent}>
              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.title,
                    notification.status === 'unread' && styles.titleUnread,
                  ]}
                  numberOfLines={2}>
                  {notification.title}
                </Text>

                {notification.status === 'unread' && (
                  <View style={[styles.unreadDot, {backgroundColor: getPriorityColor()}]} />
                )}
              </View>

              <Text style={styles.description} numberOfLines={2}>
                {notification.description}
              </Text>

              <View style={styles.footer}>
                <Text style={styles.time}>{formatTime(notification.timestamp)}</Text>
                {notification.category !== 'all' && (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{notification.category}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Avatar */}
            <View style={styles.avatarContainer}>
              {notification.avatarUrl && companion?.profileImage ? (
                <Image
                  source={{uri: companion.profileImage}}
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

      {/* Action buttons */}
      {showActions && !isDragging && (
        <View style={styles.actionButtonsContainer}>
          {notification.status === 'unread' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                Animated.spring(pan, {
                  toValue: {x: 0, y: 0},
                  useNativeDriver: false,
                }).start();
                onDismiss?.();
              }}>
              <Image
                source={Images.checkIcon}
                style={styles.actionButtonIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              Animated.spring(pan, {
                toValue: {x: 0, y: 0},
                useNativeDriver: false,
              }).start();
              onArchive?.();
            }}>
            <Image
              source={Images.crossIcon}
              style={styles.actionButtonIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      position: 'relative',
      marginBottom: theme.spacing[3],
      overflow: 'hidden',
    },
    dismissBackgroundLeft: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: '25%',
      backgroundColor: theme.colors.success,
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingLeft: theme.spacing[3],
      zIndex: -1,
    },
    archiveBackgroundRight: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: '25%',
      backgroundColor: theme.colors.warning,
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingRight: theme.spacing[3],
      zIndex: -1,
    },
    actionText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.white,
      textAlign: 'center',
    },
    card: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing[3],
      overflow: 'hidden',
    },
    cardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.borderMuted,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing[3],
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.colors.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      flexShrink: 0,
    },
    icon: {
      width: 24,
      height: 24,
      tintColor: theme.colors.white,
    },
    mainContent: {
      flex: 1,
      gap: theme.spacing[1.5],
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing[2],
    },
    title: {
      ...theme.typography.labelMediumBold,
      color: theme.colors.text,
      flex: 1,
    },
    titleUnread: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
      fontWeight: '700',
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      flexShrink: 0,
    },
    description: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      lineHeight: 16,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
      marginTop: theme.spacing[1],
    },
    time: {
      ...theme.typography.labelXsRegular,
      color: theme.colors.textSecondary,
    },
    categoryBadge: {
      paddingHorizontal: theme.spacing[2],
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: theme.colors.primaryTint,
    },
    categoryText: {
      ...theme.typography.labelXs,
      color: theme.colors.primary,
      textTransform: 'capitalize',
    },
    avatarContainer: {
      flexShrink: 0,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    avatarFallback: {
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.onPrimary,
    },
    actionButtonsContainer: {
      position: 'absolute',
      right: theme.spacing[3],
      top: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
      zIndex: 10,
    },
    actionButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.secondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionButtonIcon: {
      width: 16,
      height: 16,
      tintColor: theme.colors.white,
    },
  });
