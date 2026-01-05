import React, {useMemo} from 'react';
import {View, Text, Image, StyleSheet, TouchableOpacity, ImageSourcePropType} from 'react-native';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {SwipeableGlassCard} from '@/shared/components/common/SwipeableGlassCard/SwipeableGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {resolveImageSource} from '@/shared/utils/resolveImageSource';
import {isDummyPhoto as isDummyPhotoUrl} from '@/features/appointments/utils/photoUtils';

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
  checkInLabel = 'Check in',
  checkInDisabled = false,
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
  checkInLabel?: string;
  checkInDisabled?: boolean;
  testIDs?: {
    container?: string;
    directions?: string;
    chat?: string;
    checkIn?: string;
  };
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isDummyPhoto = React.useCallback((src?: any) => isDummyPhotoUrl(src), []);
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
        shadow: 'base',
        colorScheme: 'light',
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
              height={theme.spacing['12']}
              borderRadius={theme.borderRadius.md}
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
                borderColor={theme.colors.secondary}
                height={theme.spacing['12']}
                borderRadius={theme.borderRadius.lg}
              />
            </View>
            <View style={styles.actionButtonWrapper} testID={testIDs?.checkIn}>
              <LiquidGlassButton
                title={checkInLabel ?? 'Check in'}
                onPress={onCheckIn ?? (() => {})}
                style={styles.actionButton}
                textStyle={styles.actionButtonText}
                tintColor={theme.colors.white}
                shadowIntensity="light"
                forceBorder
                borderColor={theme.colors.secondary}
                height={theme.spacing['12']}
                borderRadius={theme.borderRadius.lg}
                disabled={checkInDisabled}
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
    },
    card: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 0,
      borderColor: 'transparent',
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing['4'],
    },
    fallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['4'],
      marginBottom: theme.spacing['3'],
    }, // Added marginBottom
    avatar: {
      width: theme.spacing['16'],
      height: theme.spacing['16'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primarySurface,
    },
    actionButton: {
      flex: 1,
      minWidth: theme.spacing['24'],
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.white,
      borderWidth: 1,
      borderColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing['5'],
    },
    actionButtonText: {
      ...theme.typography.labelSmall,
      color: theme.colors.secondary,
    },
    directionsButtonText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.white,
    },
    textBlock: {flex: 1, gap: 2},
    name: {...theme.typography.titleMedium, color: theme.colors.secondary},
    sub: {...theme.typography.labelSmallBold, color: theme.colors.placeholder},
    date: {...theme.typography.labelSmallBold, color: theme.colors.secondary},
    noteContainer: {
      marginBottom: theme.spacing['4'], // Tighter spacing to the next section
    },
    note: {...theme.typography.labelSmallBold, color: theme.colors.placeholder},
    noteLabel: {color: theme.colors.primary},
    buttonContainer: {gap: theme.spacing['4']}, // Reduced gap to bring sections closer
    inlineButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing['3'],
    },
    actionButtonWrapper: {
      flex: 1,
    },
    footer: {marginTop: theme.spacing['2']},
    touchWrapper: {
      flex: 1,
    },
  });
