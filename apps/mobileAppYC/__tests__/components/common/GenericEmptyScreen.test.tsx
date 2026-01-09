import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, screen} from '@testing-library/react-native';
import {GenericEmptyScreen} from '@/shared/components/common/GenericEmptyScreen/GenericEmptyScreen';

// --- Mocks ---

// 1. Mock useTheme

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 2. Mock react-native-safe-area-context
// We just need it to render its children
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: (props: any) => <>{props.children}</>,
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));

// --- Tests ---

describe('GenericEmptyScreen', () => {
  const props = {
    title: 'Test Title',
    subtitle: 'This is a test subtitle.',
  };

  it('renders the title and subtitle correctly', () => {
    render(<GenericEmptyScreen {...props} />);

    // Check that the title and subtitle are displayed
    expect(screen.getByText('Test Title')).toBeTruthy();
    expect(screen.getByText('This is a test subtitle.')).toBeTruthy();
  });

  it('applies the correct styles from the theme', () => {
    render(<GenericEmptyScreen {...props} />);

    // Check that the card has the correct background color from the theme
    const card = screen.getByText('Test Title').props.style;
    const subtitle = screen.getByText('This is a test subtitle.').props.style;

    // Check a few key styles to ensure the theme was applied
    expect(card.color).toBe(mockTheme.colors.secondary);
    expect(subtitle.color).toBe(mockTheme.colors.textSecondary);
  });
});
