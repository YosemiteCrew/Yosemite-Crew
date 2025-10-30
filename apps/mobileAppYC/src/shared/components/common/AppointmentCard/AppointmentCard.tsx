import React, {useMemo} from 'react';
import {View, Text, Image, StyleSheet} from 'react-native';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {SwipeableGlassCard} from '@/shared/components/common/SwipeableGlassCard/SwipeableGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export const AppointmentCard = ({
  doctorName,
  specialization,
  hospital,
  dateTime,
  note,
  avatar,
  onGetDirections,
  onChat,
  onCheckIn,
  showActions = true,
  footer,
  onViewDetails,
}: {
  doctorName: string;
  specialization: string;
  hospital: string;
  dateTime: string;
  note?: string;
  avatar: any;
  onGetDirections?: () => void;
  onChat?: () => void;
  onCheckIn?: () => void;
  showActions?: boolean;
  footer?: React.ReactNode;
  onViewDetails?: () => void;
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleViewPress = () => {
    onViewDetails?.();
  };

  return (
    <SwipeableGlassCard
      actionIcon={Images.viewIconSlide}
      onAction={handleViewPress}
      onPress={onViewDetails}
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
      {/* Top Row: Avatar and Text Block */}
      <View style={styles.topRow}>
        <Image source={avatar} style={styles.avatar} />
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
          <LiquidGlassButton
            title="Get directions"
            onPress={onGetDirections ?? (() => {})}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            textStyle={styles.directionsButtonText}
            height={48}
            borderRadius={12}
          />
          <View style={styles.inlineButtons}>
            <LiquidGlassButton
              title="Chat"
              onPress={onChat ?? (() => {})}
              style={styles.actionButton}
              textStyle={styles.actionButtonText}
              tintColor={theme.colors.white}
              shadowIntensity="light"
              forceBorder
              borderColor="#302F2E"
              height={52}
              borderRadius={16}
            />
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
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
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
      marginBottom: theme.spacing[4], // Spacing before the buttons
    },
    note: {...theme.typography.labelXsBold, color: theme.colors.placeholder},
    noteLabel: {color: theme.colors.primary},
    buttonContainer: {gap: theme.spacing[3]}, // Removed marginTop as noteContainer handles spacing
    inlineButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing[3],
    },
    footer: {marginTop: theme.spacing[2]},
  });
