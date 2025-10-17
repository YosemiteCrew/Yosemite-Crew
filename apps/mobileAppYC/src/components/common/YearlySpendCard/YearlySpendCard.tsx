import React, {useMemo, useRef} from 'react';
import {
  Animated,
  PanResponder,
  View,
  Text,
  Image,
  ImageSourcePropType,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {LiquidGlassCard} from '@/components/common/LiquidGlassCard/LiquidGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

const ACTION_WIDTH = 70;

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
  const translateX = useRef(new Animated.Value(0)).current;

  const clampTranslate = (value: number) => {
    if (value < -ACTION_WIDTH) {
      return -ACTION_WIDTH;
    }
    if (value > 0) {
      return 0;
    }
    return value;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(clampTranslate(gestureState.dx));
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldOpen = gestureState.dx < -ACTION_WIDTH / 2;
        Animated.spring(translateX, {
          toValue: shouldOpen ? -ACTION_WIDTH : 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 180,
          mass: 0.8,
        }).start();
      },
    }),
  ).current;

  const formattedAmount = useMemo(() => {
    let fallback = `${currencySymbol} ${amount}`;
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

  const handlePressView = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.8,
    }).start(() => {
      onPressView?.();
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.actionContainer}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.actionButton}
          onPress={handlePressView}>
          <TouchableOpacity style={styles.actionIcon} activeOpacity={0.85}>
                      <Image
                        source={Images.viewIconSlide}
                        style={styles.actionImage}
                      />
                    </TouchableOpacity>
        </TouchableOpacity>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.animatedWrapper, {transform: [{translateX}]}]}>
        <LiquidGlassCard
          interactive
          glassEffect="clear"
          shadow="none"
          style={styles.card}
          fallbackStyle={styles.fallback}>
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <Image source={Images.walletIcon} style={styles.icon} />
            </View>

            <View style={styles.textContainer}>
              <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
                {label}
              </Text>
              <Text
                style={styles.amount}
                numberOfLines={1}
                ellipsizeMode="tail">
                {formattedAmount}
              </Text>
            </View>

            {companionAvatar && (
              <View style={styles.companionAvatarWrapper}>
                <Image
                  source={companionAvatar}
                  style={styles.companionAvatar}
                />
              </View>
            )}
          </View>
        </LiquidGlassCard>
      </Animated.View>
    </View>
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
    actionContainer: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: ACTION_WIDTH + theme.spacing[5],
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.primaryGlass,
      borderTopRightRadius: theme.borderRadius.lg,
      borderBottomRightRadius: theme.borderRadius.lg,
      zIndex: 0,
    },
    actionButton: {
      width: 48,
      height: 48,
      paddingLeft: theme.spacing[5],
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primarySurface,
    },
        actionIcon: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionImage: {
      width: 30,
      height: 30,
      resizeMode: 'contain',
    },
    animatedWrapper: {
      zIndex: 1,
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
      backgroundColor: theme.colors.secondary,
    },
    icon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: theme.colors.white,
    },
    textContainer: {
      flex: 1,
      gap: theme.spacing[1],
    },
    label: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.placeholder,
    },
    amount: {
      ...theme.typography.h4Alt,
      color: theme.colors.secondary,
    },
    companionAvatarWrapper: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },
    companionAvatar: {
      width: '100%',
      height: '100%',
    },
  });
