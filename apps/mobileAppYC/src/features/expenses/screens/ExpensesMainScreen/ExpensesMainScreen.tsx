import React, {useEffect, useMemo, useState} from 'react';
import {Image, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import {YearlySpendCard} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {ViewMoreButton} from '@/shared/components/common/ViewMoreButton/ViewMoreButton';
import {ExpenseCard} from '@/features/expenses/components';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {resolveCurrencySymbol} from '@/shared/utils/currency';
import {setSelectedCompanion} from '@/features/companion';
import {
  fetchExpensesForCompanion,
} from '@/features/expenses';
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
  resolveSubcategoryLabel,
  resolveVisitTypeLabel,
} from '@/features/expenses/utils/expenseLabels';
import {useExpensePayment} from '@/features/expenses/hooks/useExpensePayment';
import {hasInvoice, isExpensePaid, isExpensePaymentPending} from '@/features/expenses/utils/status';
import {SafeAreaView} from 'react-native-safe-area-context';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';

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
  const {openPaymentScreen, processingPayment} = useExpensePayment();

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
              <Image source={Images.emptyExpenseIllustration} style={styles.emptyIllustration} />
              <Text style={styles.emptyTitle}>Zero bucks spent!</Text>
              <Text style={styles.emptySubtitle}>
                It seems like you and your buddy are in saving mode!
              </Text>
              <TouchableOpacity style={styles.emptyButton} onPress={handleAddExpense}>
                <Text style={styles.emptyButtonText}>Add expense</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={[styles.contentContainer, contentPaddingStyle]}
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

          <TouchableOpacity onPress={() => handleViewMore('inApp')} activeOpacity={0.85}>
            <YearlySpendCard
              amount={yearlyTotal}
              currencyCode={summaryCurrency}
              currencySymbol={currencySymbol}
              label="Yearly spend summary"
              disableSwipe={true}
            />
          </TouchableOpacity>

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
                  subcategoryLabel={resolveSubcategoryLabel(expense.category, expense.subcategory)}
                  visitTypeLabel={resolveVisitTypeLabel(expense.visitType)}
                  date={expense.date}
                  amount={expense.amount}
                  currencyCode={expense.currencyCode}
                  onPressView={() => handleViewExpense(expense.id)}
                  showEditAction={false}
                  showPayButton={isExpensePaymentPending(expense) && hasInvoice(expense)}
                  isPaid={isExpensePaid(expense)}
                  onPressPay={
                    isExpensePaymentPending(expense) && hasInvoice(expense)
                      ? () => {
                          if (!processingPayment) {
                            openPaymentScreen(expense);
                          }
                        }
                      : undefined
                  }
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>No in-app expenses yet</Text>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent external expenses</Text>
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
                  subcategoryLabel={resolveSubcategoryLabel(expense.category, expense.subcategory)}
                  visitTypeLabel={resolveVisitTypeLabel(expense.visitType)}
                  date={expense.date}
                  amount={expense.amount}
                  currencyCode={expense.currencyCode}
                  onPressView={() => handleViewExpense(expense.id)}
                  onPressEdit={() => handleEditExpense(expense.id)}
                  showEditAction
                  showPayButton={false}
                  isPaid
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>No external expenses yet</Text>
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
      gap: theme.spacing['4'],
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
      ...theme.typography.h5,
      color: theme.colors.secondary,
    },
    cardsContainer: {
      gap: theme.spacing['3'],
    },
    emptyState: {
      flexGrow: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing['6'],
      paddingVertical: theme.spacing['10'],
      gap: theme.spacing['3'],
    },
    emptyIllustration: {
      width: 220,
      height: 220,
      resizeMode: 'contain',
    },
    emptyTitle: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
      textAlign: 'center',
      marginBottom: theme.spacing['3'],
    },
    emptySubtitle: {
      ...theme.typography.paragraph,
      color: theme.colors.secondary,
      textAlign: 'center',
      marginBottom: theme.spacing['6'],
    },
    emptyButton: {
      paddingHorizontal: theme.spacing['6'],
      paddingVertical: theme.spacing['3'],
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.xl,
    },
    emptyButtonText: {
      ...theme.typography.titleSmall,
      color: theme.colors.white,
    },
    emptySection: {
      paddingVertical: theme.spacing['6'],
      paddingHorizontal: theme.spacing['4'],
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    emptySectionText: {
      ...theme.typography.paragraph,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
    },
  });

export default ExpensesMainScreen;
