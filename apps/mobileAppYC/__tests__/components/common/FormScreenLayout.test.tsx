import React from 'react';
import {render, screen} from '@testing-library/react-native';
import {FormScreenLayout} from '@/shared/components/common/FormScreenLayout';
import {Text} from 'react-native';

// --- Mocks ---

// 1. Mock 'react-redux'
jest.mock('react-redux', () => ({
  useDispatch: jest.fn(() => jest.fn()),
  useSelector: jest.fn(),
}));

// 2. Mock 'react-native' MANUALLY
jest.mock('react-native', () => {
  const ReactActual = jest.requireActual('react');

  const createMockComponent = (name: string) =>
    ReactActual.forwardRef((props: any, ref: any) =>
      ReactActual.createElement(name, {...props, ref}, props.children),
    );

  return {
    View: createMockComponent('View'),
    Text: createMockComponent('Text'),
    // Mock ScrollView with a testID for easy selecting
    ScrollView: ReactActual.forwardRef((props: any, ref: any) =>
      ReactActual.createElement(
        'ScrollView',
        {...props, ref, testID: 'mock-scroll-view'},
        props.children,
      ),
    ),
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) =>
        Array.isArray(styles) ? Object.assign({}, ...styles) : styles,
    },
    Platform: {
      OS: 'ios',
      select: (selects: any) => selects.ios,
    },
  };
});

// 3. Mock 'react-native-safe-area-context'
jest.mock('react-native-safe-area-context', () => {
  const ReactActual = jest.requireActual('react');
  return {
    SafeAreaView: (props: any) =>
      ReactActual.createElement(
        'SafeAreaView',
        {...props, testID: 'safe-area-view'},
        props.children,
      ),
  };
});

// 4. Mock LiquidGlassCard
jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => ({
  LiquidGlassCard: (props: any) => {
    const ReactActual = jest.requireActual('react');
    return ReactActual.createElement(
      'View',
      {...props, testID: 'mock-liquid-glass-card'},
      props.children,
    );
  },
}));

// 5. Mock useTheme
const mockTheme = {
  colors: {
    white: '#ffffff',
    cardBackground: '#f0f0f0',
    borderMuted: '#cccccc',
  },
  spacing: {
    '1': 4,
    '2': 8,
    '5': 20,
    '10': 40,
  },
  borderRadius: {
    lg: 12,
  },
  shadows: {
    md: {shadowOpacity: 0.5},
  },
};

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme}),
}));

// 6. Mock screenStyles
jest.mock('@/shared/utils/screenStyles', () => ({
  createScreenContainerStyles: jest.fn(() => ({container: {flex: 1}})),
}));

// --- Tests ---

describe('FormScreenLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with children', () => {
    render(
      <FormScreenLayout>
        <Text>Test Content</Text>
      </FormScreenLayout>,
    );

    expect(screen.getByTestId('safe-area-view')).toBeTruthy();
    expect(screen.getByTestId('mock-liquid-glass-card')).toBeTruthy();
    expect(screen.getByText('Test Content')).toBeTruthy();
  });

  it('passes correct styles to ScrollView', () => {
    const customContentStyle = {paddingTop: 50};
    render(
      <FormScreenLayout contentContainerStyle={customContentStyle}>
        <Text>Content</Text>
      </FormScreenLayout>,
    );

    const scrollView = screen.getByTestId('mock-scroll-view');

    // FIX: Check that the style prop contains both the default styles and custom styles
    // The component renders: contentContainerStyle={[styles.content, contentContainerStyle]}
    expect(scrollView.props.contentContainerStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paddingHorizontal: mockTheme.spacing['5'],
          paddingBottom: mockTheme.spacing['10'],
        }),
        expect.objectContaining(customContentStyle),
      ]),
    );
  });

  it('passes correct props and styles to LiquidGlassCard', () => {
    const customGlassStyle = {backgroundColor: 'red'};
    const customFallbackStyle = {opacity: 0.5};

    render(
      <FormScreenLayout
        glassCardStyle={customGlassStyle}
        glassFallbackStyle={customFallbackStyle}>
        <Text>Content</Text>
      </FormScreenLayout>,
    );

    const card = screen.getByTestId('mock-liquid-glass-card');

    expect(card.props.glassEffect).toBe('clear');
    expect(card.props.interactive).toBe(true);
    expect(card.props.tintColor).toBe(mockTheme.colors.white);

    // Verify style array merging
    expect(card.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          borderRadius: mockTheme.borderRadius.lg,
        }),
        customGlassStyle,
      ]),
    );

    expect(card.props.fallbackStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: mockTheme.colors.cardBackground,
        }),
        customFallbackStyle,
      ]),
    );
  });

  it('applies default screen container styles to SafeAreaView', () => {
    render(
      <FormScreenLayout>
        <Text>Content</Text>
      </FormScreenLayout>,
    );

    const safeArea = screen.getByTestId('safe-area-view');
    // Expect the style returned by the mocked createScreenContainerStyles
    expect(safeArea.props.style).toEqual({flex: 1});
  });
});
