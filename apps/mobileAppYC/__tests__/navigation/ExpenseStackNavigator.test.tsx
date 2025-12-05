import React from 'react';
import {render} from '@testing-library/react-native';
import {ExpenseStackNavigator} from '../../src/navigation/ExpenseStackNavigator';
import {View} from 'react-native';

// --- Mocks ---

// 1. Mock Screens
// We require React and View inside the mock to avoid ReferenceError due to hoisting
jest.mock(
  '@/features/expenses/screens/ExpensesMainScreen/ExpensesMainScreen',
  () => {
    const {View} = require('react-native');
    return {ExpensesMainScreen: () => <View testID="screen-ExpensesMain" />};
  },
);

jest.mock(
  '@/features/expenses/screens/ExpensesEmptyScreen/ExpensesEmptyScreen',
  () => {
    const {View} = require('react-native');
    return {ExpensesEmptyScreen: () => <View testID="screen-ExpensesEmpty" />};
  },
);

jest.mock(
  '@/features/expenses/screens/AddExpenseScreen/AddExpenseScreen',
  () => {
    const {View} = require('react-native');
    return {AddExpenseScreen: () => <View testID="screen-AddExpense" />};
  },
);

jest.mock(
  '@/features/expenses/screens/EditExpenseScreen/EditExpenseScreen',
  () => {
    const {View} = require('react-native');
    return {EditExpenseScreen: () => <View testID="screen-EditExpense" />};
  },
);

jest.mock(
  '@/features/expenses/screens/ExpensePreviewScreen/ExpensePreviewScreen',
  () => {
    const {View} = require('react-native');
    return {
      ExpensePreviewScreen: () => <View testID="screen-ExpensePreview" />,
    };
  },
);

jest.mock(
  '@/features/expenses/screens/ExpensesListScreen/ExpensesListScreen',
  () => {
    const {View} = require('react-native');
    return {ExpensesListScreen: () => <View testID="screen-ExpensesList" />};
  },
);

// 2. Mock Navigation
jest.mock('@react-navigation/native-stack', () => {
  const {View} = require('react-native');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({children}: any) => (
        <View testID="stack-navigator">{children}</View>
      ),
      Screen: ({name}: any) => <View testID={`screen-placeholder-${name}`} />,
    }),
  };
});

describe('ExpenseStackNavigator', () => {
  it('renders the stack navigator with all required screens', () => {
    const {getByTestId} = render(<ExpenseStackNavigator />);

    // Verify Navigator exists
    expect(getByTestId('stack-navigator')).toBeTruthy();

    // Verify all screens are registered in the stack configuration
    // Since our mock Navigator renders {children}, and the actual component renders <Stack.Screen ... />,
    // and our mock Screen component renders a View with a specific ID, checking for these IDs confirms the routes are present.

    // Note: The actual testIDs rendered are from the mock Screen implementation: `screen-placeholder-${name}`
    expect(getByTestId('screen-placeholder-ExpensesMain')).toBeTruthy();
    expect(getByTestId('screen-placeholder-ExpensesEmpty')).toBeTruthy();
    expect(getByTestId('screen-placeholder-AddExpense')).toBeTruthy();
    expect(getByTestId('screen-placeholder-EditExpense')).toBeTruthy();
    expect(getByTestId('screen-placeholder-ExpensePreview')).toBeTruthy();
    expect(getByTestId('screen-placeholder-ExpensesList')).toBeTruthy();
  });
});
