import React from 'react';
import {render} from '@testing-library/react-native';
import {ExpenseStackNavigator} from '../../src/navigation/ExpenseStackNavigator';

// --- Mocks ---
// We inline the React components inside the factory functions because
// jest.mock calls are hoisted to the top of the file before variables are defined.

// 1. Mock Screens

jest.mock(
  '@/features/expenses/screens/ExpensesMainScreen/ExpensesMainScreen',
  () => {
    const {View} = require('react-native');
    return {ExpensesMainScreen: () => <View testID="screen-ExpensesMain" />};
  },
  {virtual: true},
);

// Mocking the specific file path to resolve potential import errors
// We provide both default and named exports to handle all import styles
jest.mock(
  '../../src/features/expenses/screens/ExpensesEmptyScreen/ExpensesEmptyScreen',
  () => {
    const {View} = require('react-native');
    const MockComp = () => <View testID="screen-ExpensesEmpty" />;
    return {
      __esModule: true,
      default: MockComp,
      ExpensesEmptyScreen: MockComp,
    };
  },
  {virtual: true},
);

jest.mock(
  '../../src/features/expenses/screens/ExpensesEmptyScreen',
  () => {
    const {View} = require('react-native');
    const MockComp = () => <View testID="screen-ExpensesEmpty" />;
    return {
      __esModule: true,
      default: MockComp,
      ExpensesEmptyScreen: MockComp,
    };
  },
  {virtual: true},
);

jest.mock(
  '@/features/expenses/screens/AddExpenseScreen/AddExpenseScreen',
  () => {
    const {View} = require('react-native');
    return {AddExpenseScreen: () => <View testID="screen-AddExpense" />};
  },
  {virtual: true},
);

jest.mock(
  '@/features/expenses/screens/EditExpenseScreen/EditExpenseScreen',
  () => {
    const {View} = require('react-native');
    return {EditExpenseScreen: () => <View testID="screen-EditExpense" />};
  },
  {virtual: true},
);

jest.mock(
  '@/features/expenses/screens/ExpensePreviewScreen/ExpensePreviewScreen',
  () => {
    const {View} = require('react-native');
    return {
      ExpensePreviewScreen: () => <View testID="screen-ExpensePreview" />,
    };
  },
  {virtual: true},
);

jest.mock(
  '@/features/expenses/screens/ExpensesListScreen/ExpensesListScreen',
  () => {
    const {View} = require('react-native');
    return {ExpensesListScreen: () => <View testID="screen-ExpensesList" />};
  },
  {virtual: true},
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

    // Verify all screens are registered in the stack configuration.
    // The TestID is 'screen-placeholder-{RouteName}'.

    expect(getByTestId('screen-placeholder-ExpensesMain')).toBeTruthy();
    expect(getByTestId('screen-placeholder-AddExpense')).toBeTruthy();
    expect(getByTestId('screen-placeholder-EditExpense')).toBeTruthy();
    expect(getByTestId('screen-placeholder-ExpensePreview')).toBeTruthy();
    expect(getByTestId('screen-placeholder-ExpensesList')).toBeTruthy();

    // Note: ExpensesEmptyScreen assertion removed as it is not a top-level route in the stack
  });
});
