import React, {useEffect, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import {SafeArea, YearlySpendCard} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {CompanionSelector} from '@/components/common/CompanionSelector/CompanionSelector';
import {ExpenseCard} from '@/components/expenses';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {resolveCurrencySymbol} from '@/utils/currency';
import {setSelectedCompanion} from '@/features/companion';
import {
  fetchExpensesForCompanion,
  markInAppExpenseStatus,
} from '@/features/expenses';
import {
  selectExpenseSummaryByCompanion,
  selectExpensesLoading,
  selectHasHydratedCompanion,
  selectRecentExternalExpenses,
  selectRecentInAppExpenses,
} from '@/features/expenses/selectors';
import type {ExpensePaymentStatus} from '@/features/expenses';
import type {AppDispatch, RootState} from '@/app/store';
import type {ExpenseStackParamList} from '@/navigation/types';
import {
  resolveCategoryLabel,
  resolveSubcategoryLabel,
  resolveVisitTypeLabel,
} from '@/utils/expenseLabels';

type Navigation = NativeStackNavigationProp<ExpenseStackParamList, 'ExpensesMain'>;

export const ExpensesMainScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const companions = useSelector((state: RootState) => state.companion.companions);
  const selectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );
  const userCurrencyCode = useSelector(
    (state: RootState) => state.auth.user?.currency ?? 'USD',
  );

  const hasHydrated = useSelector(
    selectHasHydratedCompanion(selectedCompanionId ?? null),
  );
  const loading = useSelector(selectExpensesLoading);
  const summary = useSelector(selectExpenseSummaryByCompanion(selectedCompanionId ?? null));
  const recentInAppExpenses = useSelector(
    selectRecentInAppExpenses(selectedCompanionId ?? null, 2),
  );
  const recentExternalExpenses = useSelector(
    selectRecentExternalExpenses(selectedCompanionId ?? null, 2),
  );

  const [showEmptyState, setShowEmptyState] = useState(false);

  useEffect(() => {
    if (!selectedCompanionId && companions.length > 0) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, selectedCompanionId, dispatch]);

  useEffect(() => {
    if (companions.length === 0) {
      navigation.replace('ExpensesEmpty');
    }
  }, [companions.length, navigation]);

  useFocusEffect(
    React.useCallback(() => {
      if (selectedCompanionId && !hasHydrated) {
        dispatch(fetchExpensesForCompanion({companionId: selectedCompanionId}));
      }
    }, [dispatch, hasHydrated, selectedCompanionId]),
  );

  useEffect(() => {
    if (selectedCompanionId && hasHydrated) {
      dispatch(fetchExpensesForCompanion({companionId: selectedCompanionId}));
    }
  }, [dispatch, selectedCompanionId, userCurrencyCode, hasHydrated]);

  const inAppCount = recentInAppExpenses.length;
  const externalCount = recentExternalExpenses.length;

  useEffect(() => {
    const totalExpenses = inAppCount + externalCount;
    setShowEmptyState(prev =>
      prev === (totalExpenses === 0 && hasHydrated)
        ? prev
        : totalExpenses === 0 && hasHydrated,
    );
  }, [externalCount, inAppCount, hasHydrated]);

  if (companions.length === 0) {
    return null;
  }

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleAddExpense = () => {
    navigation.navigate('AddExpense');
  };

  const handleViewMore = (mode: 'inApp' | 'external') => {
    navigation.navigate('ExpensesList', {mode});
  };

  const handleViewExpense = (expenseId: string) => {
    navigation.navigate('ExpensePreview', {expenseId});
  };

  const handleEditExpense = (expenseId: string) => {
    navigation.navigate('EditExpense', {expenseId});
  };

  const handleUpdateInAppStatus = (expenseId: string, status: ExpensePaymentStatus) => {
    dispatch(markInAppExpenseStatus({expenseId, status}));
  };

  const yearlyTotal = summary?.total ?? 0;
  const currencySymbol = resolveCurrencySymbol(userCurrencyCode, '$');

  return (
    <SafeArea>
      <Header
        title="Expenses"
        showBackButton
        onBack={handleBack}
        rightIcon={Images.addIconDark}
        onRightPress={handleAddExpense}
      />
      {showEmptyState ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Zero Bucks Spent!</Text>
          <Text style={styles.emptySubtitle}>
            It seems like you and your buddy is in saving mode!
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleAddExpense}>
            <Text style={styles.emptyButtonText}>Add expense</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}>
          <CompanionSelector
            companions={companions}
            selectedCompanionId={selectedCompanionId}
            onSelect={id => dispatch(setSelectedCompanion(id))}
            showAddButton={false}
            containerStyle={styles.companionSelector}
          />

          <YearlySpendCard
            amount={yearlyTotal}
            currencyCode={userCurrencyCode}
            currencySymbol={currencySymbol}
            label="Yearly spend summary"
            onPressView={() => handleViewMore('inApp')}
          />

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent in-app expenses</Text>
            <TouchableOpacity onPress={() => handleViewMore('inApp')}>
              <Text style={styles.sectionAction}>View More</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.cardsContainer}>
            {recentInAppExpenses.map(expense => (
              <ExpenseCard
                key={expense.id}
                title={expense.title}
                categoryLabel={resolveCategoryLabel(expense.category)}
                subcategoryLabel={resolveSubcategoryLabel(expense.category, expense.subcategory)}
                visitTypeLabel={resolveVisitTypeLabel(expense.visitType)}
                date={expense.date}
                amount={expense.amount}
                currencyCode={userCurrencyCode}
                onPressView={() => handleViewExpense(expense.id)}
                showEditAction={false}
                showPayButton={expense.status !== 'paid'}
                isPaid={expense.status === 'paid'}
                onPressPay={() => handleUpdateInAppStatus(expense.id, 'paid')}
                onTogglePaidStatus={
                  expense.status === 'paid'
                    ? () => handleUpdateInAppStatus(expense.id, 'unpaid')
                    : undefined
                }
              />
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent external expenses</Text>
            <TouchableOpacity onPress={() => handleViewMore('external')}>
              <Text style={styles.sectionAction}>View More</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.cardsContainer}>
            {recentExternalExpenses.map(expense => (
              <ExpenseCard
                key={expense.id}
                title={expense.title}
                categoryLabel={resolveCategoryLabel(expense.category)}
                subcategoryLabel={resolveSubcategoryLabel(expense.category, expense.subcategory)}
                visitTypeLabel={resolveVisitTypeLabel(expense.visitType)}
                date={expense.date}
                amount={expense.amount}
                currencyCode={userCurrencyCode}
                onPressView={() => handleViewExpense(expense.id)}
                onPressEdit={() => handleEditExpense(expense.id)}
                showEditAction
                showPayButton={false}
                isPaid
              />
            ))}
          </View>
        </ScrollView>
      )}
      {loading && <View style={styles.loadingOverlay} />}
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
      paddingBottom: theme.spacing[20],
      gap: theme.spacing[4],
    },
    companionSelector: {
      marginTop: theme.spacing[4],
      marginBottom: theme.spacing[4],
    },
    sectionHeader: {
      marginTop: theme.spacing[4],
      marginBottom: theme.spacing[2],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      ...theme.typography.h5,
      color: theme.colors.secondary,
    },
    sectionAction: {
      ...theme.typography.titleSmall,
      color: theme.colors.primary,
    },
    cardsContainer: {
      gap: theme.spacing[3],
    },
    emptyState: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing[6],
    },
    emptyTitle: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
      textAlign: 'center',
      marginBottom: theme.spacing[3],
    },
    emptySubtitle: {
      ...theme.typography.paragraph,
      color: theme.colors.secondary,
      textAlign: 'center',
      marginBottom: theme.spacing[6],
    },
    emptyButton: {
      paddingHorizontal: theme.spacing[6],
      paddingVertical: theme.spacing[3],
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.xl,
    },
    emptyButtonText: {
      ...theme.typography.titleSmall,
      color: theme.colors.white,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
    },
  });

export default ExpensesMainScreen;
