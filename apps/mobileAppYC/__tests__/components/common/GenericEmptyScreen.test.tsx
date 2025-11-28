import React from 'react';
import {render, screen} from '@testing-library/react-native';
import {GenericEmptyScreen} from '@/shared/components/common/GenericEmptyScreen/GenericEmptyScreen';

// --- Mocks ---

// 1. Mock useTheme
const mockTheme = {
  colors: {
    background: 'mockBackgroundColor',
    cardBackground: 'mockCardBackgroundColor',
    border: 'mockBorderColor',
    secondary: 'mockSecondaryColor',
    textSecondary: 'mockTextColor',
  },
  typography: {
    h3: {fontSize: 24, fontWeight: 'bold'},
    paragraph: {fontSize: 16},
  },
  shadows: {
    xs: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.1,
      shadowRadius: 1,
    },
  },
};
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme}),
}));

// 2. Mock react-native-safe-area-context
// We just need it to render its children
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: (props: any) => <>{props.children}</>,
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
    expect(card.color).toBe('mockSecondaryColor');
    expect(subtitle.color).toBe('mockTextColor');
  });
});
