import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {ExpenseStackParamList} from './types';
import {ExpensesMainScreen} from '@/screens/expenses/ExpensesMainScreen/ExpensesMainScreen';
import {ExpensesEmptyScreen} from '@/screens/expenses/ExpensesEmptyScreen/ExpensesEmptyScreen';
import {AddExpenseScreen} from '@/screens/expenses/AddExpenseScreen/AddExpenseScreen';
import {EditExpenseScreen} from '@/screens/expenses/EditExpenseScreen/EditExpenseScreen';
import {ExpensePreviewScreen} from '@/screens/expenses/ExpensePreviewScreen/ExpensePreviewScreen';
import {ExpensesListScreen} from '@/screens/expenses/ExpensesListScreen/ExpensesListScreen';

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
