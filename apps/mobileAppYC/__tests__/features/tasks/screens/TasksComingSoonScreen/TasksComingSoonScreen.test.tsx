import React from 'react';
import {mockTheme} from '../../../../setup/mockTheme';
import {render, fireEvent} from '@testing-library/react-native';
import {EmptyTasksScreen} from '../../../../../src/features/tasks/screens/EmptyTasksScreen/EmptyTasksScreen';

// --- Mocks ---
//
// The Tasks screen was rebuilt to the warm-bone design: it renders the shared
// EmptyState primitive inside a LiquidGlassHeaderScreen + Header layout, and
// wires a "Add first task" CTA to navigation. We render EmptyState for real
// (so its themed title/description styling is still exercised) but mock the two
// layout wrappers minimally so the screen renders without the full liquid-glass
// shell. Ionicons and react-native-safe-area-context are mocked globally in
// jest.setup.js, so they are not re-mocked here.

const mockNavigate = jest.fn();

// 1. Mock Theme Hook (shared warm-bone theme used by the screen + EmptyState)
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 2. Mock navigation (screen calls useNavigation().navigate('AddTask'))
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));

// 3. Mock the root Header (render its title/back affordance only)
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

// 4. Mock the liquid-glass layout shell. It forwards `containerStyle` so the
// warm screen background is still assertable, and invokes the render-prop
// children with an empty content-padding style.
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

  // --- 1. Basic Rendering & Content ---

  it('renders the warm-bone empty state with the design copy', () => {
    const {getByText, getByTestId} = render(<EmptyTasksScreen />);

    // Root header title
    expect(getByText('Tasks')).toBeTruthy();

    // EmptyState primitive + its icon (globally-mocked Ionicons -> icon-<name>)
    expect(getByTestId('empty-tasks')).toBeTruthy();
    expect(getByTestId('icon-checkbox-outline')).toBeTruthy();

    // New title + description copy
    expect(getByText('Nothing on the list')).toBeTruthy();
    expect(
      getByText(
        'Doses, grooming and feeding plans will land here, with reminders that arrive on time.',
      ),
    ).toBeTruthy();

    // Primary CTA
    expect(getByText('Add first task')).toBeTruthy();
  });

  it('does not render a back button (tab root)', () => {
    const {queryByText} = render(<EmptyTasksScreen />);
    expect(queryByText('Back')).toBeNull();
  });

  // --- 2. Styling & Theme Application ---

  it('applies correct theme styles to components', () => {
    const {getByTestId, getByText} = render(<EmptyTasksScreen />);

    // Screen container background (warm screen token, not the old `background`)
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
    const title = getByText('Nothing on the list');
    expect(title.props.style).toEqual(
      expect.objectContaining({
        fontSize: mockTheme.typography.emptyStateTitle.fontSize,
        color: mockTheme.colors.ink,
        textAlign: 'center',
      }),
    );

    // Description styles (muted ink, centered)
    const description = getByText(
      'Doses, grooming and feeding plans will land here, with reminders that arrive on time.',
    );
    expect(description.props.style).toEqual(
      expect.objectContaining({
        color: mockTheme.colors.inkMuted,
        textAlign: 'center',
      }),
    );
  });

  // --- 3. Navigation Behavior ---

  it('navigates to add a task when the CTA is pressed', () => {
    const {getByTestId} = render(<EmptyTasksScreen />);

    fireEvent.press(getByTestId('empty-tasks-action'));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('AddTask');
  });
});
