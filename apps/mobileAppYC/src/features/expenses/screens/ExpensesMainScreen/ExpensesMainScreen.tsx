import React, {useEffect, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import {YearlySpendCard} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {EmptyState} from '@/shared/components/common/EmptyState/EmptyState';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {ViewMoreButton} from '@/shared/components/common/ViewMoreButton/ViewMoreButton';
import {
  ExpenseCard,
  type ExpenseCardPayment,
} from '@/features/expenses/components';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {resolveCurrencySymbol} from '@/shared/utils/currency';
import {setSelectedCompanion} from '@/features/companion';
import {fetchExpensesForCompanion} from '@/features/expenses';
import type {Expense} from '@/features/expenses';
import {
  selectExpenseSummaryByCompanion,
  selectExpensesLoading,
  selectHasHydratedCompanion,
  selectRecentExternalExpenses,
  selectRecentInAppExpenses,
} from '@/features/expenses/selectors';
import type {AppDispatch, RootState} from '@/app/store';
import type {ExpenseStackParamList} from '@/navigation/types';
import {
  resolveCategoryLabel,
  resolveVisitTypeLabel,
} from '@/features/expenses/utils/expenseLabels';
import {useExpensePayment} from '@/features/expenses/hooks/useExpensePayment';
import {
  hasInvoice,
  isExpensePaid,
  isExpensePaymentPending,
} from '@/features/expenses/utils/status';
import {SafeAreaView} from 'react-native-safe-area-context';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';

type Navigation = NativeStackNavigationProp<
  ExpenseStackParamList,
  'ExpensesMain'
>;

export const ExpensesMainScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const companions = useSelector(
    (state: RootState) => state.companion.companions,
  );
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
  const summary = useSelector(
    selectExpenseSummaryByCompanion(selectedCompanionId ?? null),
  );
  const recentInAppExpenses = useSelector(
    selectRecentInAppExpenses(selectedCompanionId ?? null, 2),
  );
  const recentExternalExpenses = useSelector(
    selectRecentExternalExpenses(selectedCompanionId ?? null, 2),
  );
  const {openPaymentScreen, processingPayment} = useExpensePayment();

  const [showEmptyState, setShowEmptyState] = useState(false);

  useEffect(() => {
    if (!selectedCompanionId && companions.length > 0) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, selectedCompanionId, dispatch]);

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

  const getInAppExpensePayment = React.useCallback(
    (expense: Expense): ExpenseCardPayment | undefined => {
      if (isExpensePaid(expense)) {
        return {status: 'paid'};
      }

      if (!isExpensePaymentPending(expense) || !hasInvoice(expense)) {
        return undefined;
      }

      return {
        status: 'unpaid',
        cta: {
          onPress: () => {
            if (!processingPayment) {
              openPaymentScreen(expense);
            }
          },
        },
      };
    },
    [openPaymentScreen, processingPayment],
  );

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

  const yearlyTotal = summary?.total ?? 0;
  const summaryCurrency = summary?.currencyCode ?? userCurrencyCode;
  const currencySymbol = resolveCurrencySymbol(summaryCurrency, '$');

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <LiquidGlassHeaderScreen
        header={
          <Header
            title="Expenses"
            showBackButton
            onBack={handleBack}
            rightIcon={Images.addIconDark}
            onRightPress={handleAddExpense}
            glass={false}
          />
        }
        contentPadding={theme.spacing['3']}>
        {contentPaddingStyle =>
          showEmptyState ? (
            <ScrollView
              contentContainerStyle={[styles.emptyState, contentPaddingStyle]}
              showsVerticalScrollIndicator={false}>
              <EmptyState
                testID="expenses-empty"
                icon={
                  <Ionicons
                    name="wallet-outline"
                    size={42}
                    color={theme.colors.blueText}
                  />
                }
                title="No expenses yet"
                description="Vet bills, food and insurance will add up here, so the year's spend is a number, not a shoebox."
                actionLabel="Add first expense"
                actionIcon={
                  <Ionicons name="add" size={18} color={theme.colors.ctaText} />
                }
                onAction={handleAddExpense}
              />
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={[
                styles.contentContainer,
                contentPaddingStyle,
              ]}
              showsVerticalScrollIndicator={false}>
              <CompanionSelector
                companions={companions}
                selectedCompanionId={selectedCompanionId}
                onSelect={id => dispatch(setSelectedCompanion(id))}
                showAddButton={false}
                containerStyle={styles.companionSelector}
                requiredPermission="expenses"
                permissionLabel="expenses"
              />

              <PressableOpacity
                onPress={() => handleViewMore('inApp')}
                activeOpacity={0.85}>
                <YearlySpendCard
                  amount={yearlyTotal}
                  currencyCode={summaryCurrency}
                  currencySymbol={currencySymbol}
                  label="Yearly spend summary"
                  disableSwipe={true}
                />
              </PressableOpacity>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent in-app expenses</Text>
                {recentInAppExpenses.length > 0 && (
                  <ViewMoreButton onPress={() => handleViewMore('inApp')} />
                )}
              </View>
              {recentInAppExpenses.length > 0 ? (
                <View style={styles.cardsContainer}>
                  {recentInAppExpenses.map(expense => (
                    <ExpenseCard
                      key={expense.id}
                      title={expense.title}
                      categoryLabel={resolveCategoryLabel(expense.category)}
                      visitTypeLabel={resolveVisitTypeLabel(expense.visitType)}
                      date={expense.date}
                      amount={expense.amount}
                      currencyCode={expense.currencyCode}
                      onPressView={() => handleViewExpense(expense.id)}
                      editAction="hidden"
                      payment={getInAppExpensePayment(expense)}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>
                    No in-app expenses yet
                  </Text>
                </View>
              )}

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Recent external expenses
                </Text>
                {recentExternalExpenses.length > 0 && (
                  <ViewMoreButton onPress={() => handleViewMore('external')} />
                )}
              </View>
              {recentExternalExpenses.length > 0 ? (
                <View style={styles.cardsContainer}>
                  {recentExternalExpenses.map(expense => (
                    <ExpenseCard
                      key={expense.id}
                      title={expense.title}
                      categoryLabel={resolveCategoryLabel(expense.category)}
                      visitTypeLabel={resolveVisitTypeLabel(expense.visitType)}
                      date={expense.date}
                      amount={expense.amount}
                      currencyCode={expense.currencyCode}
                      onPressView={() => handleViewExpense(expense.id)}
                      onPressEdit={() => handleEditExpense(expense.id)}
                      editAction="visible"
                      payment={{status: 'paid'}}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>
                    No external expenses yet
                  </Text>
                </View>
              )}
            </ScrollView>
          )
        }
      </LiquidGlassHeaderScreen>
      {(loading || processingPayment) && <View style={styles.loadingOverlay} />}
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing['6'],
      paddingBottom: theme.spacing['20'],
      gap: theme.spacing['3'],
    },
    companionSelector: {
      marginTop: theme.spacing['4'],
      marginBottom: theme.spacing['4'],
    },
    sectionHeader: {
      marginTop: theme.spacing['4'],
      marginBottom: theme.spacing['2'],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      ...theme.typography.eyebrow,
      color: theme.colors.inkFaint,
    },
    cardsContainer: {
      gap: theme.spacing['3'],
    },
    emptyState: {
      flexGrow: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing['10'],
    },
    emptySection: {
      paddingVertical: theme.spacing['6'],
      paddingHorizontal: theme.spacing['4'],
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.borderRadius.cardSmall,
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
    },
    emptySectionText: {
      ...theme.typography.paragraph,
      color: theme.colors.inkMuted,
      textAlign: 'center',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
    },
  });

export default ExpensesMainScreen;
