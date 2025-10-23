import React, {useMemo} from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SwipeableGlassCard} from '@/components/common/SwipeableGlassCard/SwipeableGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {formatDateForDisplay} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
import {formatCurrency, resolveCurrencySymbol} from '@/utils/currency';

const ACTION_WIDTH = 65;
const OVERLAP_WIDTH = 12;
const TOTAL_ACTION_WIDTH = ACTION_WIDTH * 2;

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

  const visibleActionWidth = showEditAction ? TOTAL_ACTION_WIDTH : ACTION_WIDTH;
  const totalActionWidth = OVERLAP_WIDTH + visibleActionWidth;

  return (
    <SwipeableGlassCard
      actionIcon={Images.viewIconSlide}
      actionWidth={hideSwipeActions ? 0 : totalActionWidth}
      actionBackgroundColor="transparent"
      actionOverlap={hideSwipeActions ? 0 : OVERLAP_WIDTH}
      containerStyle={styles.container}
      cardProps={{
        interactive: true,
        glassEffect: 'clear',
        shadow: 'none',
        style: styles.card,
        fallbackStyle: styles.fallback,
      }}
      actionContainerStyle={hideSwipeActions ? styles.hiddenActionContainer : styles.actionContainer}
      renderActionContent={
        hideSwipeActions
          ? undefined
          : close => (
              <View style={styles.actionWrapper}>
                <View
                  style={[
                    styles.overlapContainer,
                    {
                      width: OVERLAP_WIDTH,
                      backgroundColor: showEditAction
                        ? theme.colors.primary
                        : theme.colors.success,
                    },
                  ]}
                />

                {showEditAction && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.actionButton, styles.editActionButton, {width: ACTION_WIDTH}]}
                    onPress={() => {
                      close();
                      onPressEdit?.();
                    }}>
                    <Image source={Images.editIconSlide} style={styles.actionIcon} />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.actionButton, styles.viewActionButton, {width: ACTION_WIDTH}]}
                  onPress={() => {
                    close();
                    onPressView?.();
                  }}>
                  <Image source={Images.viewIconSlide} style={styles.actionIcon} />
                </TouchableOpacity>
              </View>
            )
      }>
      <TouchableOpacity
        activeOpacity={onPressView ? 0.85 : 1}
        onPress={onPressView}
        style={styles.innerContent}>
        <View style={styles.infoRow}>
          <View style={styles.thumbnailContainer}>
            <Image
              source={thumbnail ?? Images.documentFallback}
              style={styles.thumbnail}
            />
          </View>
          <View style={styles.textContent}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
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

          <View style={styles.amountColumn}>
            <Text style={styles.amount}>{formattedAmount}</Text>
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
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.payButton}
            onPress={onPressPay}>
            <Image source={Images.currencyIcon} style={styles.payIcon} />
            <Text style={styles.payLabel}>Pay {payCtaLabel}</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </SwipeableGlassCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      width: '100%',
      alignSelf: 'center',
      marginBottom: theme.spacing[3],
    },
    card: {
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[4],
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    fallback: {
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[4],
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    actionContainer: {
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'flex-end',
    },
    hiddenActionContainer: {
      width: 0,
    },
    actionWrapper: {
      flexDirection: 'row',
      height: '100%',
      width: '100%',
      backgroundColor: theme.colors.primary,
      borderTopRightRadius: theme.borderRadius.lg,
      borderBottomRightRadius: theme.borderRadius.lg,
      overflow: 'hidden',
    },
    overlapContainer: {
      height: '100%',
    },
    actionButton: {
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    editActionButton: {
      backgroundColor: theme.colors.primary,
    },
    viewActionButton: {
      backgroundColor: theme.colors.success,
      borderTopRightRadius: theme.borderRadius.lg,
      borderBottomRightRadius: theme.borderRadius.lg,
    },
    actionIcon: {
      width: 30,
      height: 30,
      resizeMode: 'contain',
    },
    innerContent: {
      width: '100%',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    thumbnailContainer: {
      width: 54,
      height: 54,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: theme.colors.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbnail: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    textContent: {
      flex: 1,
      gap: theme.spacing[1],
    },
    title: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
    },
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
    amountColumn: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: theme.spacing[2],
      minWidth: 70,
    },
    amount: {
      ...theme.typography.h5,
      color: theme.colors.secondary,
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
    payButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing[2],
      paddingHorizontal: theme.spacing[4],
      marginTop: theme.spacing[3],
      gap: theme.spacing[2],
      backgroundColor: theme.colors.white,
      minHeight: 45,
    },
    payIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: theme.colors.secondary,
    },
    payLabel: {
      ...theme.typography.button,
      color: theme.colors.secondary,
    },
  });

export default ExpenseCard;
