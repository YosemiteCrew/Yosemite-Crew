import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {ExpenseStackParamList} from './types';
import {ExpensesMainScreen} from '@/features/expenses/screens/ExpensesMainScreen/ExpensesMainScreen';
import {ExpensesEmptyScreen} from '@/features/expenses/screens/ExpensesEmptyScreen/ExpensesEmptyScreen';
import {AddExpenseScreen} from '@/features/expenses/screens/AddExpenseScreen/AddExpenseScreen';
import {EditExpenseScreen} from '@/features/expenses/screens/EditExpenseScreen/EditExpenseScreen';
import {ExpensePreviewScreen} from '@/features/expenses/screens/ExpensePreviewScreen/ExpensePreviewScreen';
import {ExpensesListScreen} from '@/features/expenses/screens/ExpensesListScreen/ExpensesListScreen';

const Stack = createNativeStackNavigator<ExpenseStackParamList>();

export const ExpenseStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="ExpensesMain" component={ExpensesMainScreen} />
      <Stack.Screen name="ExpensesEmpty" component={ExpensesEmptyScreen} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
      <Stack.Screen name="EditExpense" component={EditExpenseScreen} />
      <Stack.Screen name="ExpensePreview" component={ExpensePreviewScreen} />
      <Stack.Screen name="ExpensesList" component={ExpensesListScreen} />
    </Stack.Navigator>
  );
};
