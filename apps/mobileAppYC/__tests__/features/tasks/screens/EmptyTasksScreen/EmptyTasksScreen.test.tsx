import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
// Path: 5 levels up from __tests__/features/tasks/screens/EmptyTasksScreen/ to project root
import {EmptyTasksScreen} from '../../../../../src/features/tasks/screens/EmptyTasksScreen/EmptyTasksScreen';
import {mockTheme} from '../../../../setup/mockTheme';

// --- Mocks ---

const mockNavigate = jest.fn();
const mockParentNavigate = jest.fn();

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    getParent: () => ({navigate: mockParentNavigate}),
  }),
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
      LiquidGlassHeaderScreen: ({header, children, containerStyle}: any) => (
        <View testID="screen-layout" style={containerStyle}>
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
    expect(getByText('Add a companion to get started')).toBeTruthy();
    expect(
      getByText(
        'Tasks like doses, grooming and feeding plans are tied to a companion. Add one first to start creating tasks.',
      ),
    ).toBeTruthy();
    expect(getByText('Add a companion')).toBeTruthy();
  });

  it('does not render a back button (tab root)', () => {
    const {queryByText} = render(<EmptyTasksScreen />);
    expect(queryByText('Back')).toBeNull();
  });

  it('applies correct theme styles to components', () => {
    const {getByTestId, getByText} = render(<EmptyTasksScreen />);

    // Screen container background (warm screen token)
    const screenLayout = getByTestId('screen-layout');
    const layoutStyle = Array.isArray(screenLayout.props.style)
      ? screenLayout.props.style.filter(Boolean)[0]
      : screenLayout.props.style;
    expect(layoutStyle).toEqual(
      expect.objectContaining({
        backgroundColor: mockTheme.colors.screen,
        flex: 1,
      }),
    );

    // Title styles (emptyStateTitle typography + ink color)
    const title = getByText('Add a companion to get started');
    expect(title.props.style).toEqual(
      expect.objectContaining({
        fontSize: mockTheme.typography.emptyStateTitle.fontSize,
        color: mockTheme.colors.ink,
        textAlign: 'center',
      }),
    );

    // Description styles (muted ink, centered)
    const description = getByText(
      'Tasks like doses, grooming and feeding plans are tied to a companion. Add one first to start creating tasks.',
    );
    expect(description.props.style).toEqual(
      expect.objectContaining({
        color: mockTheme.colors.inkMuted,
        textAlign: 'center',
      }),
    );
  });

  it('navigates to add a companion when the CTA is pressed', () => {
    const {getByTestId} = render(<EmptyTasksScreen />);

    fireEvent.press(getByTestId('empty-tasks-action'));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockParentNavigate).toHaveBeenCalledWith('HomeStack', {
      screen: 'AddCompanion',
    });
  });
});
