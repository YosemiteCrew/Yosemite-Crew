import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
// Path: 5 levels up from __tests__/features/tasks/screens/EmptyTasksScreen/ to project root
import {EmptyTasksScreen} from '../../../../../src/features/tasks/screens/EmptyTasksScreen/EmptyTasksScreen';
import {mockTheme} from '../../../../setup/mockTheme';

// --- Mocks ---

const mockNavigate = jest.fn();

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));

jest.mock('@/shared/components/common/Header/Header', () => {
  const {View, Text} = require('react-native');
  return {
    Header: ({title, showBackButton}: any) => (
      <View testID="header">
        <Text>{title}</Text>
        {showBackButton ? <Text>Back</Text> : null}
      </View>
    ),
  };
});

jest.mock(
  '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => {
    const {View} = require('react-native');
    return {
      LiquidGlassHeaderScreen: ({header, children}: any) => (
        <View testID="screen-layout">
          {header}
          {typeof children === 'function' ? children({}) : children}
        </View>
      ),
    };
  },
);

describe('EmptyTasksScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the warm-bone empty state with the design copy', () => {
    const {getByText, getByTestId} = render(<EmptyTasksScreen />);

    expect(getByText('Tasks')).toBeTruthy();
    expect(getByTestId('empty-tasks')).toBeTruthy();
    expect(getByText('Nothing on the list')).toBeTruthy();
    expect(
      getByText(
        'Doses, grooming and feeding plans will land here, with reminders that arrive on time.',
      ),
    ).toBeTruthy();
    expect(getByText('Add first task')).toBeTruthy();
  });

  it('does not render a back button (tab root)', () => {
    const {queryByText} = render(<EmptyTasksScreen />);
    expect(queryByText('Back')).toBeNull();
  });

  it('navigates to add a task when the CTA is pressed', () => {
    const {getByTestId} = render(<EmptyTasksScreen />);

    fireEvent.press(getByTestId('empty-tasks-action'));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('AddTask');
  });
});
