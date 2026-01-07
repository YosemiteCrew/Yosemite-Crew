import React, {useMemo} from 'react';
import {
  View,
  Text,
  Image,
  ImageSourcePropType,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {SwipeableGlassCard} from '@/shared/components/common/SwipeableGlassCard/SwipeableGlassCard';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {createGlassCardStyles, createCardContentStyles, createTextContainerStyles} from '@/shared/utils/cardStyles';
import {formatCurrency, resolveCurrencySymbol} from '@/shared/utils/currency';

export interface YearlySpendCardProps {
  amount?: number;
  currencySymbol?: string;
  currencyCode?: string;
  label?: string;
  companionAvatar?: ImageSourcePropType;
  onPressView?: () => void;
  disableSwipe?: boolean;
}

export const YearlySpendCard: React.FC<YearlySpendCardProps> = ({
  amount = 0,
  currencySymbol = '$',
  currencyCode = 'USD',
  label = 'Yearly spend summary',
  companionAvatar,
  onPressView,
  disableSwipe = false,
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
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handleViewPress}
      style={styles.content}
    >
      <View style={styles.iconCircle}>
        <Image source={Images.walletIcon} style={styles.icon} />
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
        <Text style={styles.amount} numberOfLines={1} ellipsizeMode="tail">
          {formattedAmount.replaceAll('\u00A0', ' ')}
        </Text>
      </View>

      {companionAvatar && (
        <View style={styles.companionAvatarWrapper}>
          <Image source={companionAvatar} style={styles.companionAvatar} />
        </View>
      )}
    </TouchableOpacity>
  );

  if (disableSwipe) {
    return (
      <LiquidGlassCard
        interactive
        glassEffect="clear"
        style={styles.card}
        fallbackStyle={styles.fallback}
      >
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
        shadow: 'base',
        style: styles.card,
        fallbackStyle: styles.fallback,
      }}
      springConfig={{useNativeDriver: true, damping: 18, stiffness: 180, mass: 0.8}}
    >
      {cardContent}
    </SwipeableGlassCard>
  );
};

const createStyles = (theme: any) => {
  const glassCardStyles = createGlassCardStyles(theme, {borderWidth: 0});
  const contentStyles = createCardContentStyles(theme, '4');
  const textStyles = createTextContainerStyles(theme, '1');

  return StyleSheet.create({
    container: {
      width: '100%',
      alignSelf: 'center',
    },
    ...glassCardStyles,
    ...contentStyles,
    iconCircle: {
      width: theme.spacing['10'],
      height: theme.spacing['10'],
      borderRadius: theme.borderRadius.lg,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.border,
    },
    icon: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
      resizeMode: 'contain',
    },
    ...textStyles,
    label: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.textSecondary,
    },
    amount: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
    },
    companionAvatarWrapper: {
      width: theme.spacing['10'],
      height: theme.spacing['10'],
      borderRadius: theme.borderRadius.lg,
      borderWidth: 2,
      borderColor: theme.colors.white,
    },
    companionAvatar: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
  });
};

export default YearlySpendCard;
