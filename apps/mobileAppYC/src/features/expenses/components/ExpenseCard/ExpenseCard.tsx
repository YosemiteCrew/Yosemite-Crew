import React, {useMemo} from 'react';
import {Image, ImageSourcePropType, StyleSheet, Text, View} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {SwipeableActionCard} from '@/shared/components/common/SwipeableActionCard/SwipeableActionCard';
import {CardActionButton} from '@/shared/components/common/CardActionButton/CardActionButton';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {formatDateForDisplay} from '@/shared/components/common/SimpleDatePicker/dateTimeFormat';
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
  subcategoryLabel: string;
  visitTypeLabel: string;
  date: string;
  amount: number;
  currencyCode: string;
  thumbnail?: ImageSourcePropType;
  onPressView?: () => void;
  onPressEdit?: () => void;
  editAction?: ExpenseCardActionVisibility;
  payment?: ExpenseCardPayment;
  swipeActions?: ExpenseCardSwipeMode;
}

export const ExpenseCard: React.FC<ExpenseCardProps> = ({
  title,
  categoryLabel,
  subcategoryLabel,
  visitTypeLabel,
  date,
  amount,
  currencyCode,
  thumbnail,
  onPressView,
  onPressEdit,
  editAction = 'visible',
  payment,
  swipeActions = 'enabled',
}) => {
  const {theme} = useTheme();
  const baseStyles = useMemo(() => createCardStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
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
        <View style={baseStyles.infoRow}>
          <View style={baseStyles.thumbnailContainer}>
            <Image
              source={thumbnail ?? Images.documentFallback}
              style={baseStyles.thumbnail}
            />
          </View>
          <View style={baseStyles.textContent}>
            <Text
              style={baseStyles.title}
              numberOfLines={1}
              ellipsizeMode="tail">
              {title}
            </Text>
            <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
              Category: <Text style={styles.metaValue}>{categoryLabel}</Text>
            </Text>
            <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
              Sub category:{' '}
              <Text style={styles.metaValue}>{subcategoryLabel}</Text>
            </Text>
            <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
              Visit type: <Text style={styles.metaValue}>{visitTypeLabel}</Text>
            </Text>
            <Text style={styles.date}>
              {formatDateForDisplay(new Date(date))}
            </Text>
          </View>

          <View style={baseStyles.rightColumn}>
            <Text style={baseStyles.amount}>{formattedAmount}</Text>
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
    meta: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    metaValue: {
      ...theme.typography.labelSmall,
      color: theme.colors.secondary,
    },
    date: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    paidBadge: {
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: theme.spacing['1'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.successSurface,
    },
    paidBadgeInteractive: {
      borderWidth: 1,
      borderColor: theme.colors.success,
    },
    paidText: {
      ...theme.typography.labelSmall,
      color: theme.colors.success,
    },
  });

export default ExpenseCard;
