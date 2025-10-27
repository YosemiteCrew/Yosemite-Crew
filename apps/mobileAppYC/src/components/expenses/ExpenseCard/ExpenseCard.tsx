import React, {useMemo} from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SwipeableActionCard} from '@/components/common/SwipeableActionCard/SwipeableActionCard';
import {CardActionButton} from '@/components/common/CardActionButton/CardActionButton';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {formatDateForDisplay} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
import {formatCurrency, resolveCurrencySymbol} from '@/utils/currency';
import {createCardStyles} from '@/components/common/cardStyles';

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
  onPressPay?: () => void;
  showEditAction?: boolean;
  showPayButton?: boolean;
  isPaid?: boolean;
  payButtonLabel?: string;
  hideSwipeActions?: boolean;
  onTogglePaidStatus?: () => void;
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
  onPressPay,
  showEditAction = true,
  showPayButton = false,
  isPaid = false,
  payButtonLabel,
  hideSwipeActions = false,
  onTogglePaidStatus,
}) => {
  const {theme} = useTheme();
  const baseStyles = useMemo(() => createCardStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const formattedAmount = useMemo(() => {
    const formatted = formatCurrency(amount, {
      currencyCode,
      minimumFractionDigits: 0,
    });
  return formatted.replaceAll('\u00A0', ' ');
  }, [amount, currencyCode]);

  const payCtaLabel = useMemo(() => {
    if (payButtonLabel) {
      return payButtonLabel;
    }
    const symbol = resolveCurrencySymbol(currencyCode, '$');
    return `${symbol}${amount.toFixed(2)}`;
  }, [amount, currencyCode, payButtonLabel]);

  return (
    <SwipeableActionCard
      cardStyle={baseStyles.card}
      fallbackStyle={baseStyles.fallback}
      onPressView={onPressView}
      onPressEdit={onPressEdit}
      showEditAction={showEditAction}
      hideSwipeActions={hideSwipeActions}
    >
      <TouchableOpacity
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
            <Text style={baseStyles.title} numberOfLines={1} ellipsizeMode="tail">
              {title}
            </Text>
            <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
              Category: <Text style={styles.metaValue}>{categoryLabel}</Text>
            </Text>
            <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
              Sub category: <Text style={styles.metaValue}>{subcategoryLabel}</Text>
            </Text>
            <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
              Visit type: <Text style={styles.metaValue}>{visitTypeLabel}</Text>
            </Text>
            <Text style={styles.date}>{formatDateForDisplay(new Date(date))}</Text>
          </View>

          <View style={baseStyles.rightColumn}>
            <Text style={baseStyles.amount}>{formattedAmount}</Text>
            {isPaid &&
              (onTogglePaidStatus ? (
                <TouchableOpacity
                  style={[styles.paidBadge, styles.paidBadgeInteractive]}
                  activeOpacity={0.8}
                  onPress={onTogglePaidStatus}>
                  <Text style={styles.paidText}>Paid</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.paidBadge}>
                  <Text style={styles.paidText}>Paid</Text>
                </View>
              ))}
          </View>
        </View>

        {showPayButton && !isPaid && (
          <CardActionButton
            label={`Pay ${payCtaLabel}`}
            icon={Images.currencyIcon}
            onPress={onPressPay!}
            variant="primary"
          />
        )}
      </TouchableOpacity>
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
      color: theme.colors.secondary,
      fontFamily: theme.typography.bodySmall.fontFamily,
      fontWeight: theme.typography.bodySmall.fontWeight,
    },
    date: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    paidBadge: {
      paddingHorizontal: theme.spacing[2],
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(0, 143, 93, 0.12)',
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
