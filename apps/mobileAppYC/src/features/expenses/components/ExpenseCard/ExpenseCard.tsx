import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {SwipeableActionCard} from '@/shared/components/common/SwipeableActionCard/SwipeableActionCard';
import {CardActionButton} from '@/shared/components/common/CardActionButton/CardActionButton';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {formatCurrency, resolveCurrencySymbol} from '@/shared/utils/currency';
import {createCardStyles} from '@/shared/components/common/cardStyles';

export type ExpenseCardActionVisibility = 'visible' | 'hidden';
export type ExpenseCardSwipeMode = 'enabled' | 'hidden';

export type ExpenseCardPayment =
  | {
      status: 'paid';
      onToggleStatus?: () => void;
    }
  | {
      status: 'unpaid';
      cta?: {
        onPress: () => void;
        label?: string;
      };
    };

export interface ExpenseCardProps {
  title: string;
  categoryLabel: string;
  visitTypeLabel: string;
  date: string;
  amount: number;
  currencyCode: string;
  onPressView?: () => void;
  onPressEdit?: () => void;
  editAction?: ExpenseCardActionVisibility;
  payment?: ExpenseCardPayment;
  swipeActions?: ExpenseCardSwipeMode;
}

const META_SEPARATOR = '  ·  ';

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const formatMetaDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return `${parsed.getDate()} ${MONTHS_SHORT[parsed.getMonth()]}`;
};

interface CategoryVisual {
  icon: string;
  background: string;
  color: string;
}

const resolveCategoryVisual = (
  theme: any,
  categoryLabel: string,
): CategoryVisual => {
  const key = categoryLabel?.trim().toLowerCase() ?? '';
  if (key.includes('health')) {
    return {
      icon: 'medkit-outline',
      background: theme.colors.blueSoft,
      color: theme.colors.blueText,
    };
  }
  if (key.includes('hygiene')) {
    return {
      icon: 'cut-outline',
      background: theme.colors.pinkGlow,
      color: theme.colors.pink,
    };
  }
  if (
    key.includes('diet') ||
    key.includes('food') ||
    key.includes('nutrition')
  ) {
    return {
      icon: 'nutrition-outline',
      background: theme.colors.avatarGreenBg,
      color: theme.colors.avatarGreenInk,
    };
  }
  if (key.includes('admin')) {
    return {
      icon: 'folder-open-outline',
      background: theme.colors.avatarVioletBg,
      color: theme.colors.avatarVioletInk,
    };
  }
  return {
    icon: 'pricetag-outline',
    background: theme.colors.screen2,
    color: theme.colors.inkMuted,
  };
};

export const ExpenseCard: React.FC<ExpenseCardProps> = ({
  title,
  categoryLabel,
  visitTypeLabel,
  date,
  amount,
  currencyCode,
  onPressView,
  onPressEdit,
  editAction = 'visible',
  payment,
  swipeActions = 'enabled',
}) => {
  const {theme} = useTheme();
  const baseStyles = useMemo(() => createCardStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const categoryVisual = useMemo(
    () => resolveCategoryVisual(theme, categoryLabel),
    [theme, categoryLabel],
  );
  const paidToggle =
    payment?.status === 'paid' ? payment.onToggleStatus : undefined;
  const paymentCta = payment?.status === 'unpaid' ? payment.cta : undefined;

  const formattedAmount = useMemo(() => {
    const formatted = formatCurrency(amount, {
      currencyCode,
      minimumFractionDigits: 0,
    });
    return formatted.replaceAll('\u00A0', ' ');
  }, [amount, currencyCode]);

  const metaLine = useMemo(() => {
    const segments = [categoryLabel, visitTypeLabel]
      .map(segment => segment?.trim())
      .filter((segment): segment is string => Boolean(segment));
    const formattedDate = formatMetaDate(date);
    if (formattedDate) {
      segments.push(formattedDate);
    }
    return segments.join(META_SEPARATOR);
  }, [categoryLabel, visitTypeLabel, date]);

  const payCtaLabel = useMemo(() => {
    if (paymentCta?.label) {
      return paymentCta.label;
    }
    const symbol = resolveCurrencySymbol(currencyCode, '$');
    return `${symbol}${amount.toFixed(2)}`;
  }, [amount, currencyCode, paymentCta?.label]);

  return (
    <SwipeableActionCard
      cardStyle={baseStyles.card}
      fallbackStyle={baseStyles.fallback}
      onPressView={onPressView}
      onPressEdit={onPressEdit}
      showEditAction={editAction === 'visible'}
      hideSwipeActions={swipeActions === 'hidden'}>
      <PressableOpacity
        activeOpacity={onPressView ? 0.85 : 1}
        onPress={onPressView}
        style={baseStyles.innerContent}>
        <View style={styles.row}>
          <View
            style={[
              styles.iconTile,
              {backgroundColor: categoryVisual.background},
            ]}>
            <Ionicons
              name={categoryVisual.icon}
              size={18}
              color={categoryVisual.color}
            />
          </View>
          <View style={styles.textContent}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {title}
            </Text>
            {metaLine ? (
              <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
                {metaLine}
              </Text>
            ) : null}
          </View>

          <View style={styles.amountColumn}>
            <Text style={styles.amount}>{formattedAmount}</Text>
            {payment?.status === 'paid' &&
              (paidToggle ? (
                <PressableOpacity
                  style={[styles.paidBadge, styles.paidBadgeInteractive]}
                  activeOpacity={0.8}
                  onPress={paidToggle}>
                  <Text style={styles.paidText}>Paid</Text>
                </PressableOpacity>
              ) : (
                <View style={styles.paidBadge}>
                  <Text style={styles.paidText}>Paid</Text>
                </View>
              ))}
          </View>
        </View>

        {paymentCta && (
          <CardActionButton
            label={`Pay ${payCtaLabel}`}
            icon={Images.currencyIcon}
            onPress={paymentCta.onPress}
            variant="primary"
          />
        )}
      </PressableOpacity>
    </SwipeableActionCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
    },
    iconTile: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textContent: {
      flex: 1,
    },
    title: {
      fontSize: 14.5,
      fontWeight: '600',
      color: theme.colors.inkBody,
    },
    meta: {
      fontSize: 12.5,
      color: theme.colors.inkFaint,
      marginTop: 2,
    },
    amountColumn: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: theme.spacing['1.25'],
    },
    amount: {
      ...theme.typography.pillSubtitleBold15,
      color: theme.colors.ink,
      fontVariant: ['tabular-nums'],
    },
    paidBadge: {
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: 3,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.successSurface,
    },
    paidBadgeInteractive: {
      borderWidth: 1,
      borderColor: theme.colors.success,
    },
    paidText: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.success,
    },
  });

export default ExpenseCard;
