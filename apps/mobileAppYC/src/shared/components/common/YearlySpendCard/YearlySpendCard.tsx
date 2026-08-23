import React, {useMemo} from 'react';
import {View, Text, Image, ImageSourcePropType, StyleSheet} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {SwipeableGlassCard} from '@/shared/components/common/SwipeableGlassCard/SwipeableGlassCard';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {formatCurrency, resolveCurrencySymbol} from '@/shared/utils/currency';

export interface YearlySpendCardProps {
  amount?: number;
  currencySymbol?: string;
  currencyCode?: string;
  label?: string;
  companionAvatar?: ImageSourcePropType;
  onPressView?: () => void;
  disableSwipe?: boolean;
  /** Smaller serif amount for summary contexts (e.g. the Home dashboard). */
  compact?: boolean;
}

export const YearlySpendCard: React.FC<YearlySpendCardProps> = ({
  amount = 0,
  currencySymbol = '$',
  currencyCode = 'USD',
  label = 'Yearly spend summary',
  companionAvatar,
  onPressView,
  disableSwipe = false,
  compact = false,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const resolvedSymbol = useMemo(
    () => currencySymbol || resolveCurrencySymbol(currencyCode, '$'),
    [currencySymbol, currencyCode],
  );

  const formattedAmount = useMemo(() => {
    try {
      return formatCurrency(amount, {
        currencyCode,
        minimumFractionDigits: 0,
      });
    } catch {
      return `${resolvedSymbol} ${amount}`;
    }
  }, [amount, currencyCode, resolvedSymbol]);

  const handleViewPress = () => {
    onPressView?.();
  };

  const cardContent = (
    <PressableOpacity
      activeOpacity={0.85}
      onPress={handleViewPress}
      style={styles.content}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${formattedAmount.replaceAll(' ', ' ')}`}>
      <View style={styles.textContainer}>
        <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
        <Text
          style={compact ? styles.amountCompact : styles.amount}
          numberOfLines={1}
          ellipsizeMode="tail">
          {formattedAmount.replaceAll('\u00A0', ' ')}
        </Text>
      </View>

      {companionAvatar && (
        <View style={styles.companionAvatarWrapper}>
          <Image source={companionAvatar} style={styles.companionAvatar} />
        </View>
      )}
    </PressableOpacity>
  );

  if (disableSwipe) {
    return (
      <LiquidGlassCard
        interactive
        glassEffect="clear"
        shadow="card"
        style={styles.card}
        fallbackStyle={styles.fallback}>
        {cardContent}
      </LiquidGlassCard>
    );
  }

  return (
    <SwipeableGlassCard
      actionIcon={Images.viewIconSlide}
      onAction={handleViewPress}
      actionBackgroundColor={theme.colors.success}
      containerStyle={styles.container}
      cardProps={{
        interactive: true,
        glassEffect: 'clear',
        shadow: 'card',
        style: styles.card,
        fallbackStyle: styles.fallback,
      }}
      springConfig={{
        useNativeDriver: true,
        damping: 18,
        stiffness: 180,
        mass: 0.8,
      }}>
      {cardContent}
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
      backgroundColor: theme.colors.screen,
      borderColor: theme.colors.hairline,
      borderWidth: 1,
      borderRadius: theme.borderRadius.card,
      padding: theme.spacing['4.5'],
      overflow: 'hidden',
    },
    fallback: {
      backgroundColor: theme.colors.screen,
      borderColor: theme.colors.hairline,
      borderWidth: 1,
      borderRadius: theme.borderRadius.card,
      overflow: 'hidden',
    },
    content: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing['3'],
    },
    textContainer: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    label: {
      ...theme.typography.caption,
      color: theme.colors.inkMuted,
    },
    amount: {
      ...theme.typography.amountHero,
      color: theme.colors.ink,
      fontVariant: ['tabular-nums'],
    },
    amountCompact: {
      ...theme.typography.amountHero,
      fontSize: 24,
      lineHeight: 30,
      color: theme.colors.ink,
      fontVariant: ['tabular-nums'],
    },
    companionAvatarWrapper: {
      width: theme.spacing['10'],
      height: theme.spacing['10'],
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      overflow: 'hidden',
    },
    companionAvatar: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
  });

export default YearlySpendCard;
