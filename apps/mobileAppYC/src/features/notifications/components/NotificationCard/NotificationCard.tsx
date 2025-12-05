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

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

export const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  companion,
  onPress,
  onDismiss,
  onArchive,
  swipeEnabled = true,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const companionAvatarUri = useMemo(
    () => normalizeImageUri(companion?.profileImage ?? null),
    [companion?.profileImage],
  );

  const pan = React.useRef(new Animated.ValueXY()).current;
  const [isDragging, setIsDragging] = React.useState(false);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !!swipeEnabled,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (!swipeEnabled) return false;
        const {dx} = gestureState;
        return Math.abs(dx) > 5;
      },
      onPanResponderGrant: () => {
        if (swipeEnabled) setIsDragging(true);
      },
      onPanResponderMove: Animated.event([null, {dx: pan.x}], {useNativeDriver: false}),
      onPanResponderRelease: (evt, gestureState) => {
        if (!swipeEnabled) return;
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

  const animatedStyle = {
    transform: [{translateX: pan.x}],
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]} {...panResponder.panHandlers}>
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
            <View style={[styles.iconContainer, isDragging && styles.iconContainerDragging]}> 
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
                <Text style={styles.time}>{formatTime(notification.timestamp)}</Text>
              </View>
            </View>

            {/* Avatar */}
            <View style={styles.avatarContainer}>
              {notification.avatarUrl && companionAvatarUri ? (
                <Image source={{uri: companionAvatarUri}} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{avatarInitial}</Text>
                </View>
              )}
            </View>
          </View>
        </LiquidGlassCard>
      </TouchableOpacity>
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
    card: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing[3],
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
      gap: theme.spacing[3],
    },
    pressable: {
      flex: 1,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#EAEAEA',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    iconContainerDragging: {
      opacity: 0.7,
    },
    icon: {
      width: 24,
      height: 24,
    },
    mainContent: {
      flex: 1,
      gap: theme.spacing[1],
    },
    title: {
      ...theme.typography.titleSmall,
      color: '#302F2E',
      flex: 1,
    },
    description: {
      ...theme.typography.bodyExtraSmall,
      color: '#595958',
      lineHeight: 15.6,
      overflow: 'hidden',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      marginTop: theme.spacing[1],
    },
    time: {
      fontFamily: fonts.SATOSHI_BOLD,
      fontSize: 11,
      lineHeight: 13.2,
      fontWeight: '700',
      color: '#747473',
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
      backgroundColor: '#EAEAEA',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.text,
    },
  });
