import React from 'react';
import {render} from '@testing-library/react-native';
import {TasksComingSoonScreen} from '../../../../../src/features/tasks/screens/TasksComingSoonScreen/TasksComingSoonScreen';

// --- Mocks ---

// 1. Mock Theme Hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#ffffff',
        secondary: '#000000',
        textSecondary: '#666666',
      },
      spacing: {
        '2': 8,
        '6': 24,
      },
      typography: {
        titleLarge: {
          fontSize: 24,
          fontWeight: 'bold',
        },
        bodyLarge: {
          fontSize: 16,
          fontWeight: 'normal',
        },
      },
    },
  }),
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
  };
});

describe('TasksComingSoonScreen', () => {
  // --- 1. Basic Rendering & Content ---

  it('renders the screen with correct title and subtitle', () => {
    const {getByText} = render(<TasksComingSoonScreen />);

    expect(getByText('Tasks coming soon')).toBeTruthy();
    expect(
      getByText(
        'We are finishing the task experience. Please check back shortly.',
      ),
    ).toBeTruthy();
  });

  // --- 2. Styling & Theme Application ---

  it('applies correct theme styles to components', () => {
    const {getByTestId, getByText} = render(<TasksComingSoonScreen />);

    // Check Safe Area Background (theme.colors.background)
    const safeArea = getByTestId('safe-area');
    expect(safeArea.props.style).toEqual(
      expect.objectContaining({
        backgroundColor: '#ffffff',
        flex: 1,
      }),
    );

    // Check Title Styles (typography + color)
    const title = getByText('Tasks coming soon');
    expect(title.props.style).toEqual(
      expect.objectContaining({
        fontSize: 24, // from mock titleLarge
        color: '#000000', // from mock secondary
        textAlign: 'center',
      }),
    );

    // Check Subtitle Styles (typography + color)
    const subtitle = getByText(
      'We are finishing the task experience. Please check back shortly.',
    );
    expect(subtitle.props.style).toEqual(
      expect.objectContaining({
        fontSize: 16, // from mock bodyLarge
        color: '#666666', // from mock textSecondary
        textAlign: 'center',
      }),
    );
  });
});
