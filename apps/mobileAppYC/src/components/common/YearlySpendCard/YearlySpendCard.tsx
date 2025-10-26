import React, {useMemo} from 'react';
import {
  View,
  Text,
  Image,
  ImageSourcePropType,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {SwipeableGlassCard} from '@/components/common/SwipeableGlassCard/SwipeableGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {createGlassCardStyles, createCardContentStyles, createTextContainerStyles} from '@/utils/cardStyles';
import {formatCurrency, resolveCurrencySymbol} from '@/utils/currency';

export interface YearlySpendCardProps {
  amount?: number;
  currencySymbol?: string;
  currencyCode?: string;
  label?: string;
  companionAvatar?: ImageSourcePropType;
  onPressView?: () => void;
}

export const YearlySpendCard: React.FC<YearlySpendCardProps> = ({
  amount = 0,
  currencySymbol = '$',
  currencyCode = 'USD',
  label = 'Yearly spend summary',
  companionAvatar,
  onPressView,
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
    </SwipeableGlassCard>
  );
};

const createStyles = (theme: any) => {
  const glassCardStyles = createGlassCardStyles(theme);
  const contentStyles = createCardContentStyles(theme, 4);
  const textStyles = createTextContainerStyles(theme, 1);

  return StyleSheet.create({
    container: {
      width: '100%',
      alignSelf: 'center',
    },
    ...glassCardStyles,
    ...contentStyles,
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
    ...textStyles,
    label: {
      fontFamily: theme.typography.labelXsBold.fontFamily,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 13.2,
      color: '#595958',
    },
    amount: {
      fontFamily: theme.typography.h3.fontFamily,
      fontSize: 23,
      fontWeight: '500',
      lineHeight: 27.6,
      letterSpacing: -0.23,
      color: '#302F2E',
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
};

export default YearlySpendCard;
