import React, {useMemo, useCallback, useEffect} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {useNavigation, useRoute, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {SafeArea, YearlySpendCard} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {ExpenseCard} from '@/features/expenses/components';
import {useTheme} from '@/hooks';
import {setSelectedCompanion} from '@/features/companion';
import {
  selectExternalExpensesByCompanion,
  selectExpenseSummaryByCompanion,
  selectInAppExpensesByCompanion,
  selectHasHydratedCompanion,
  fetchExpensesForCompanion,
} from '@/features/expenses';
import type {AppDispatch, RootState} from '@/app/store';
import type {ExpenseStackParamList} from '@/navigation/types';
import {
  resolveCategoryLabel,
  resolveSubcategoryLabel,
  resolveVisitTypeLabel,
} from '@/features/expenses/utils/expenseLabels';
import type {Expense} from '@/features/expenses';
import {resolveCurrencySymbol} from '@/shared/utils/currency';
import {useExpensePayment} from '@/features/expenses/hooks/useExpensePayment';
import {hasInvoice, isExpensePaid, isExpensePaymentPending} from '@/features/expenses/utils/status';

type Navigation = NativeStackNavigationProp<ExpenseStackParamList, 'ExpensesList'>;
type Route = RouteProp<ExpenseStackParamList, 'ExpensesList'>;

export const ExpensesListScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const {mode} = route.params;
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
  const summary = useSelector(
    selectExpenseSummaryByCompanion(selectedCompanionId ?? null),
  );
  const hasHydrated = useSelector(
    selectHasHydratedCompanion(selectedCompanionId ?? null),
  );

  const inAppExpenses = useSelector(
    selectInAppExpensesByCompanion(selectedCompanionId ?? null),
  );
  const externalExpenses = useSelector(
    selectExternalExpensesByCompanion(selectedCompanionId ?? null),
  );
  const {openPaymentScreen, processingPayment} = useExpensePayment();

  const data = mode === 'inApp' ? inAppExpenses : externalExpenses;

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

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleViewExpense = (expenseId: string) => {
    navigation.navigate('ExpensePreview', {expenseId});
  };

  const handleEditExpense = (expenseId: string) => {
    if (mode === 'external') {
      navigation.navigate('EditExpense', {expenseId});
    }
  };

  const renderSeparator = useCallback(
    () => <View style={styles.separator} />,
    [styles.separator],
  );

  const renderItem = ({item}: {item: Expense}) => (
    <ExpenseCard
      key={item.id}
      title={item.title}
      categoryLabel={resolveCategoryLabel(item.category)}
      subcategoryLabel={resolveSubcategoryLabel(item.category, item.subcategory)}
      visitTypeLabel={resolveVisitTypeLabel(item.visitType)}
      date={item.date}
      amount={item.amount}
      currencyCode={item.currencyCode}
      onPressView={() => handleViewExpense(item.id)}
      onPressEdit={
        mode === 'external' ? () => handleEditExpense(item.id) : undefined
      }
      showEditAction={mode === 'external'}
      showPayButton={mode === 'inApp' && isExpensePaymentPending(item) && hasInvoice(item)}
      isPaid={isExpensePaid(item)}
      onPressPay={
        mode === 'inApp' && isExpensePaymentPending(item) && hasInvoice(item)
          ? () => {
              if (!processingPayment) {
                openPaymentScreen(item);
              }
            }
          : undefined
      }
    />
  );

  const yearlyTotal = summary?.total ?? 0;
  const summaryCurrency = summary?.currencyCode ?? userCurrencyCode;
  const currencySymbol = resolveCurrencySymbol(summaryCurrency, '$');
  const listTitle = mode === 'inApp' ? 'In-app expenses' : 'External expenses';

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <CompanionSelector
        companions={companions}
        selectedCompanionId={selectedCompanionId}
        onSelect={id => dispatch(setSelectedCompanion(id))}
        showAddButton={false}
        containerStyle={styles.selector}
        requiredPermission="expenses"
        permissionLabel="expenses"
      />
      <YearlySpendCard
        amount={yearlyTotal}
        currencyCode={summaryCurrency}
        currencySymbol={currencySymbol}
        label="Yearly spend summary"
      />
      <Text style={styles.listHeading}>{listTitle}</Text>
    </View>
  );

  return (
    <SafeArea>
      <Header title="Expenses" showBackButton onBack={handleBack} />
      <View style={styles.container}>
        <FlatList<Expense>
          data={data}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No expenses to show yet.</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listHeader: {
      paddingTop: theme.spacing['4'],
      paddingBottom: theme.spacing['2'],
    },
    selector: {
      marginBottom: theme.spacing['4'],
    },
    listContent: {
      paddingHorizontal: theme.spacing['4'],
      paddingBottom: theme.spacing['24'],
    },
    separator: {
      height: theme.spacing['3'],
    },
    listHeading: {
      ...theme.typography.h5,
      color: theme.colors.secondary,
      marginTop: theme.spacing['4'],
      marginBottom: theme.spacing['3'],
    },
    emptyContainer: {
      paddingVertical: theme.spacing['10'],
      alignItems: 'center',
    },
    emptyText: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
    },
  });

export default ExpensesListScreen;
