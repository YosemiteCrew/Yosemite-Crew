import React, {useMemo} from 'react';
import {View, Text, Image, ImageSourcePropType, StyleSheet} from 'react-native';
import {SwipeableGlassCard} from '@/components/common/SwipeableGlassCard/SwipeableGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export interface YearlySpendCardProps {
  amount?: number;
  currencySymbol?: string;
  label?: string;
  companionAvatar?: ImageSourcePropType;
  onPressView?: () => void;
}

export const YearlySpendCard: React.FC<YearlySpendCardProps> = ({
  amount = 0,
  currencySymbol = '$',
  label = 'Yearly spend summary',
  companionAvatar,
  onPressView,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const formattedAmount = useMemo(() => {
    const fallback = `${currencySymbol} ${amount}`;
    if (typeof Intl !== 'undefined') {
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
        }).format(amount);
      } catch {
        return fallback;
      }
    }
    return fallback;
  }, [amount, currencySymbol]);

  const handleViewPress = () => {
    onPressView?.();
  };

  return (
    <SwipeableGlassCard
      actionIcon={Images.viewIconSlide}
      onAction={handleViewPress}
      actionBackgroundColor={theme.colors.success}
      containerStyle={styles.container}
      cardProps={{
        interactive: true,
        glassEffect: 'clear',
        shadow: 'none',
        style: styles.card,
        fallbackStyle: styles.fallback,
      }}
      springConfig={{useNativeDriver: true, damping: 18, stiffness: 180, mass: 0.8}}
    >
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Image source={Images.walletIcon} style={styles.icon} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
            {label}
          </Text>
          <Text style={styles.amount} numberOfLines={1} ellipsizeMode="tail">
            {formattedAmount}
          </Text>
        </View>

        {companionAvatar && (
          <View style={styles.companionAvatarWrapper}>
            <Image source={companionAvatar} style={styles.companionAvatar} />
          </View>
        )}
      </View>
    </SwipeableGlassCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      width: '100%',
      alignSelf: 'center',
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
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[4],
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
    },
    icon: {
      width: 24,
      height: 24,
      resizeMode: 'contain',
    },
    textContainer: {
      flex: 1,
      gap: theme.spacing[1],
    },
    label: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
    },
    amount: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
    },
    companionAvatarWrapper: {
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: theme.colors.white,
    },
    companionAvatar: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
  });

export default YearlySpendCard;
