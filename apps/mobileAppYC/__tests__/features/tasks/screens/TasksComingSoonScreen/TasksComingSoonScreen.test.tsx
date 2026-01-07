import React from 'react';
import {mockTheme} from '../../../../setup/mockTheme';
import {render} from '@testing-library/react-native';
import {EmptyTasksScreen} from '../../../../../src/features/tasks/screens/EmptyTasksScreen/EmptyTasksScreen';

// --- Mocks ---

// 1. Mock Theme Hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 2. Mock SafeAreaView
// Fix: We must require('react-native') inside the factory because
// 'View' from the top-level import is not accessible here due to hoisting.
jest.mock('react-native-safe-area-context', () => {
  const {View} = require('react-native');
  return {
    SafeAreaView: ({children, style}: any) => (
      <View testID="safe-area" style={style}>
        {children}
      </View>
    ),
    useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
  };
});

describe('EmptyTasksScreen', () => {
  // --- 1. Basic Rendering & Content ---

  it('renders the screen with correct title and subtitle', () => {
    const {getByText} = render(<EmptyTasksScreen />);

    expect(getByText('No tasks yet!')).toBeTruthy();
    expect(
      getByText(/Add a companion first to start creating tasks/),
    ).toBeTruthy();
  });

  // --- 2. Styling & Theme Application ---

  it('applies correct theme styles to components', () => {
    const {getByTestId, getByText} = render(<EmptyTasksScreen />);

    // Check Safe Area Background (theme.colors.background)
    const safeArea = getByTestId('safe-area');
    const safeAreaStyle = Array.isArray(safeArea.props.style)
      ? safeArea.props.style.filter(Boolean)[0]
      : safeArea.props.style;
    expect(safeAreaStyle).toEqual(
      expect.objectContaining({
        backgroundColor: mockTheme.colors.background,
        flex: 1,
      }),
    );

    // Check Title Styles (typography + color)
    const title = getByText('No tasks yet!');
    expect(title.props.style).toEqual(
      expect.objectContaining({
        fontSize: mockTheme.typography.headlineMedium.fontSize,
        color: mockTheme.colors.secondary,
        textAlign: 'center',
      }),
    );

    // Check Subtitle Styles (typography + color)
    const subtitle = getByText(/Add a companion first to start creating tasks/);
    expect(subtitle.props.style).toEqual(
      expect.objectContaining({
        fontSize: mockTheme.typography.bodyMedium.fontSize,
        color: mockTheme.colors.textSecondary,
        textAlign: 'center',
      }),
    );
  });
});
