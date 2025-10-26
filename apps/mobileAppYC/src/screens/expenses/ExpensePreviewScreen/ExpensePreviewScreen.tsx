import React, {useMemo} from 'react';
import {Image, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {useTheme} from '@/hooks';
import type {AppDispatch, RootState} from '@/app/store';
import {
  markInAppExpenseStatus,
  selectExpenseById,
} from '@/features/expenses';
import type {ExpenseStackParamList} from '@/navigation/types';
import {Images} from '@/assets/images';
import {formatCurrency} from '@/utils/currency';
import {
  resolveCategoryLabel,
  resolveSubcategoryLabel,
  resolveVisitTypeLabel,
} from '@/utils/expenseLabels';
import AttachmentPreview from '@/components/common/AttachmentPreview/AttachmentPreview';

type Navigation = NativeStackNavigationProp<ExpenseStackParamList, 'ExpensePreview'>;
type Route = RouteProp<ExpenseStackParamList, 'ExpensePreview'>;

export const ExpensePreviewScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {expenseId} = route.params;
  const expense = useSelector(selectExpenseById(expenseId));
  const companions = useSelector((state: RootState) => state.companion.companions);
  const companion = expense
    ? companions.find(item => item.id === expense.companionId)
    : null;
  const userCurrencyCode = useSelector(
    (state: RootState) => state.auth.user?.currency ?? 'USD',
  );

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  if (!expense) {
    return (
      <SafeArea>
        <Header title="Expense" showBackButton onBack={handleBack} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Expense not found</Text>
        </View>
      </SafeArea>
    );
  }

  const canEdit = expense.source === 'external';
  const formattedAmount = formatCurrency(expense.amount, {
    currencyCode: userCurrencyCode,
  });

  const handleEdit = () => {
    if (canEdit) {
      navigation.navigate('EditExpense', {expenseId});
    }
  };

  // Sharing handled per-attachment in AttachmentPreview component

  const handlePay = () => {
    dispatch(markInAppExpenseStatus({expenseId: expense.id, status: 'paid'}));
  };

  return (
    <SafeArea>
      <Header
        title="Expenses"
        showBackButton
        onBack={handleBack}
        rightIcon={canEdit ? Images.blackEdit : undefined}
        onRightPress={canEdit ? handleEdit : undefined}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{expense.title}</Text>
          <Text style={styles.summarySubtitle}>
            {resolveCategoryLabel(expense.category)}
          </Text>
          <Text style={styles.summarySubtitle}>
            Sub category: {resolveSubcategoryLabel(expense.category, expense.subcategory)}
          </Text>
          <Text style={styles.summarySubtitle}>
            Visit type: {resolveVisitTypeLabel(expense.visitType)}
          </Text>
          <Text style={styles.summaryDate}>
            {new Date(expense.date).toLocaleDateString()}
          </Text>
          <Text style={styles.summaryAmount}>{formattedAmount}</Text>
          {expense.source === 'inApp' && expense.status === 'unpaid' ? (
            <TouchableOpacity style={styles.payButton} onPress={handlePay}>
              <Image source={Images.walletIcon} style={styles.payIcon} />
              <Text style={styles.payLabel}>Pay {formattedAmount}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.paidBadge}>
              <Text style={styles.paidText}>
                {expense.source === 'inApp' ? 'Paid' : companion?.name ?? ''}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.previewContainer}>
          {expense.attachments && expense.attachments.length > 0 ? (
            <AttachmentPreview attachments={expense.attachments} />
          ) : (
            <View style={styles.fallbackCard}>
              <Image source={Images.documentIcon} style={styles.fallbackIcon} />
              <Text style={styles.fallbackTitle}>No attachments</Text>
              <Text style={styles.fallbackText}>There are no files attached to this expense.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[12],
      gap: theme.spacing[4],
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
    },
    summaryCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing[4],
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      gap: theme.spacing[1],
    },
    summaryTitle: {
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
    },
    summarySubtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    summaryDate: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing[1],
    },
    summaryAmount: {
      ...theme.typography.h5,
      color: theme.colors.secondary,
      marginTop: theme.spacing[2],
    },
    payButton: {
      marginTop: theme.spacing[4],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.xl,
      paddingVertical: theme.spacing[2],
      gap: theme.spacing[2],
    },
    payIcon: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
    },
    payLabel: {
      ...theme.typography.label,
      color: theme.colors.secondary,
    },
    paidBadge: {
      marginTop: theme.spacing[3],
      paddingVertical: theme.spacing[1],
      paddingHorizontal: theme.spacing[3],
      borderRadius: theme.borderRadius.full,
      backgroundColor: 'rgba(0, 143, 93, 0.12)',
      alignSelf: 'flex-start',
    },
    paidText: {
      ...theme.typography.labelSmall,
      color: theme.colors.success,
    },
    previewContainer: {
      gap: theme.spacing[4],
    },
    fallbackCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing[6],
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    fallbackIcon: {
      width: 64,
      height: 64,
      marginBottom: theme.spacing[4],
      tintColor: theme.colors.textSecondary,
    },
    fallbackTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing[2],
    },
    fallbackText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

export default ExpensePreviewScreen;
