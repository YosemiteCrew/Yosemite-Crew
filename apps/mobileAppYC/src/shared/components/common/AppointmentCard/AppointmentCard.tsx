import React, {useMemo} from 'react';
import {View, Text, Image, StyleSheet, TouchableOpacity, ImageSourcePropType} from 'react-native';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {SwipeableGlassCard} from '@/shared/components/common/SwipeableGlassCard/SwipeableGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {resolveImageSource} from '@/shared/utils/resolveImageSource';

export const AppointmentCard = ({
  doctorName,
  specialization,
  hospital,
  dateTime,
  note,
  avatar,
  fallbackAvatar,
  onAvatarError,
  onGetDirections,
  onChat,
  onCheckIn,
  canChat = true,
  onChatBlocked,
  showActions = true,
  footer,
  onViewDetails,
  onPress,
  testIDs,
}: {
  doctorName: string;
  specialization: string;
  hospital: string;
  dateTime: string;
  note?: string;
  avatar: any;
  fallbackAvatar?: ImageSourcePropType | number | string | null;
  onAvatarError?: () => void;
  onGetDirections?: () => void;
  onChat?: () => void;
  canChat?: boolean;
  onChatBlocked?: () => void;
  onCheckIn?: () => void;
  showActions?: boolean;
  footer?: React.ReactNode;
  onViewDetails?: () => void;
  onPress?: () => void;
  testIDs?: {
    container?: string;
    directions?: string;
    chat?: string;
    checkIn?: string;
  };
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isDummyPhoto = React.useCallback((src?: any) => {
    if (typeof src !== 'string') return false;
    return src.includes('example.com') || src.includes('placeholder');
  }, []);
  const [avatarSource, setAvatarSource] = React.useState<any>(avatar);
  const resolvedAvatar = useMemo(
    () => resolveImageSource(avatarSource ?? avatar ?? fallbackAvatar ?? Images.cat),
    [avatar, avatarSource, fallbackAvatar],
  );

  const handleViewPress = () => {
    onViewDetails?.();
  };

  const handlePress = () => {
    onPress?.();
  };

  const handleAvatarError = React.useCallback(() => {
    onAvatarError?.();
    if (fallbackAvatar && avatarSource !== fallbackAvatar) {
      setAvatarSource(fallbackAvatar as any);
    }
  }, [avatarSource, fallbackAvatar, onAvatarError]);

  React.useEffect(() => {
    if (fallbackAvatar && isDummyPhoto(avatar)) {
      setAvatarSource(fallbackAvatar as any);
    }
  }, [avatar, fallbackAvatar, isDummyPhoto]);

  React.useEffect(() => {
    if (avatar && avatarSource !== avatar && !(fallbackAvatar && isDummyPhoto(avatar))) {
      setAvatarSource(avatar);
    }
  }, [avatar, avatarSource, fallbackAvatar, isDummyPhoto]);

  return (
    <SwipeableGlassCard
      actionIcon={Images.viewIconSlide}
      onAction={handleViewPress}
      onPress={handlePress}
      actionBackgroundColor={theme.colors.success}
      containerStyle={styles.container}
      cardProps={{
        glassEffect: 'clear',
        interactive: true,
        shadow: 'none',
        style: styles.card,
        fallbackStyle: styles.fallback,
      }}
      springConfig={{
        useNativeDriver: true,
        damping: 18,
        stiffness: 180,
        mass: 0.8,
      }}
      enableHorizontalSwipeOnly={true}>
      <TouchableOpacity
        activeOpacity={onPress ? 0.85 : 1}
        onPress={handlePress}
        disabled={!onPress}
        style={styles.touchWrapper}
        testID={testIDs?.container}
      >
        {/* Top Row: Avatar and Text Block */}
        <View style={styles.topRow}>
          <Image source={resolvedAvatar} style={styles.avatar} onError={handleAvatarError} />
          <View style={styles.textBlock}>
            <Text style={styles.name}>{doctorName}</Text>
            <Text style={styles.sub}>{specialization}</Text>
            <Text style={styles.sub}>{hospital}</Text>
            <Text style={styles.date}>{dateTime}</Text>
          </View>
        </View>

        {/* Note Container - NEW LOCATION */}
        {note && (
          <View style={styles.noteContainer}>
            <Text style={styles.note}>
              <Text style={styles.noteLabel}>Note: </Text>
              {note}
            </Text>
          </View>
        )}

        {/* Buttons */}
        {showActions && (
          <View style={styles.buttonContainer}>
          <View testID={testIDs?.directions}>
            <LiquidGlassButton
              title="Get directions"
              onPress={onGetDirections ?? (() => {})}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              textStyle={styles.directionsButtonText}
              height={48}
              borderRadius={12}
            />
          </View>
          <View style={styles.inlineButtons}>
            <View style={styles.actionButtonWrapper} testID={testIDs?.chat}>
              <LiquidGlassButton
                title="Chat"
                onPress={
                  canChat
                    ? onChat ?? (() => {})
                    : onChatBlocked ?? (() => {})
                }
                style={styles.actionButton}
                textStyle={styles.actionButtonText}
                tintColor={theme.colors.white}
                shadowIntensity="light"
                forceBorder
                borderColor="#302F2E"
                height={52}
                borderRadius={16}
              />
            </View>
            <View style={styles.actionButtonWrapper} testID={testIDs?.checkIn}>
              <LiquidGlassButton
                title="Check in"
                onPress={onCheckIn ?? (() => {})}
                style={styles.actionButton}
                textStyle={styles.actionButtonText}
                tintColor={theme.colors.white}
                shadowIntensity="light"
                forceBorder
                borderColor="#302F2E"
                height={52}
                borderRadius={16}
              />
            </View>
          </View>
        </View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </TouchableOpacity>
    </SwipeableGlassCard>
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
    card: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      overflow: 'hidden',
      backgroundColor: theme.colors.cardBackground,
      ...theme.shadows.md,
      shadowColor: theme.colors.neutralShadow,
      padding: theme.spacing[4],
    },
    fallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[4],
      marginBottom: theme.spacing[3],
    }, // Added marginBottom
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.colors.primarySurface,
    },
    actionButton: {
      flex: 1,
      minWidth: 100,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.white,
      borderWidth: 1,
      borderColor: '#302F2E',
      borderRadius: 16,
      paddingHorizontal: 20,
    },
    actionButtonText: {
      ...theme.typography.businessTitle16,
      color: '#302F2E',
      lineHeight: 19.2,
      letterSpacing: -0.16,
    },
    directionsButtonText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.white,
    },
    textBlock: {flex: 1, gap: 2},
    name: {...theme.typography.titleMedium, color: theme.colors.secondary},
    sub: {...theme.typography.labelXsBold, color: theme.colors.placeholder},
    date: {...theme.typography.labelXsBold, color: theme.colors.secondary},
    noteContainer: {
      marginBottom: theme.spacing[2], // Tighter spacing to the next section
    },
    note: {...theme.typography.labelXsBold, color: theme.colors.placeholder},
    noteLabel: {color: theme.colors.primary},
    buttonContainer: {gap: theme.spacing[2]}, // Reduced gap to bring sections closer
    inlineButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing[3],
    },
    actionButtonWrapper: {
      flex: 1,
    },
    footer: {marginTop: theme.spacing[2]},
    touchWrapper: {
      flex: 1,
    },
  });
