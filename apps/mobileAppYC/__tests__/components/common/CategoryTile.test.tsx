import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {CategoryTile} from '@/shared/components/common/CategoryTile/CategoryTile';
import {mockTheme} from '../setup/mockTheme';
import {useTheme} from '@/hooks';

// --- Mocks ---

// 1. Mock useTheme
jest.mock('@/hooks', () => {
  const {mockTheme: theme} = require('../setup/mockTheme');
  return {
    __esModule: true,
    useTheme: jest.fn(() => ({theme, isDark: false})),
  };
});

// 2. Mock PressableOpacity to a simple host element that forwards onPress,
//    testID and style so presses and style passthrough can be asserted.
//    (Ionicons is globally mocked in jest.setup.js and renders as a Text node
//    with testID `icon-<name>`.)
jest.mock(
  '@/shared/components/common/PressableOpacity/PressableOpacity',
  () => {
    const ReactActual = require('react');
    const {View} = require('react-native');
    return {
      __esModule: true,
      PressableOpacity: ({children, testID, onPress, style, ...props}: any) =>
        ReactActual.createElement(
          View,
          {testID, onPress, style, ...props},
          children,
        ),
    };
  },
);

// 3. Mock react-native primitives
jest.mock('react-native', () => {
  const ReactActual = jest.requireActual('react');
  const RN = jest.requireActual('react-native');

  const createMockComponent = (name: string, testID?: string) =>
    ReactActual.forwardRef((props: any, ref: any) =>
      ReactActual.createElement(name, {
        ...props,
        ref,
        testID: props.testID || testID,
      }),
    );

  return {
    View: createMockComponent('View'),
    Text: createMockComponent('Text', 'mock-text'),
    Image: createMockComponent('Image', 'mock-image'),
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) => styles,
    },
    Platform: RN.Platform,
    PixelRatio: RN.PixelRatio,
    Appearance: {
      getColorScheme: jest.fn(() => 'light'),
      addChangeListener: jest.fn(() => ({remove: jest.fn()})),
    },
  };
});

// --- Tests ---

describe('CategoryTile', () => {
  const mockOnPress = jest.fn();
  const mockIcon = {uri: 'mock-icon-uri'};

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({theme: mockTheme, isDark: false});
  });

  const renderTile = (
    props: Partial<React.ComponentProps<typeof CategoryTile>> = {},
  ) =>
    render(
      <CategoryTile
        icon={mockIcon}
        title="Health"
        subtitle="Vaccination records"
        onPress={mockOnPress}
        {...props}
      />,
    );

  it('renders the title, subtitle and trailing chevron', () => {
    const {getByText, getByTestId} = renderTile();

    expect(getByText('Health')).toBeTruthy();
    expect(getByText('Vaccination records')).toBeTruthy();
    // Ionicons chevron (globally mocked → testID `icon-<name>`)
    expect(getByTestId('icon-chevron-forward')).toBeTruthy();
  });

  it('calls onPress when the tile is pressed', () => {
    const {getByTestId} = renderTile();

    fireEvent.press(getByTestId('category-tile'));

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('exposes a button role and combined label on the tile', () => {
    const {getByTestId} = renderTile();
    const tile = getByTestId('category-tile');
    expect(tile.props.accessibilityRole).toBe('button');
    expect(tile.props.accessibilityLabel).toBe('Health, Vaccination records');
  });

  it('renders the count badge when a count is provided', () => {
    const {getByTestId, getByText} = renderTile({count: 7});

    const badge = getByTestId('category-tile-count');
    expect(badge).toBeTruthy();
    expect(getByText('7')).toBeTruthy();
  });

  it('does not render the count badge when count is omitted', () => {
    const {queryByTestId} = renderTile();

    expect(queryByTestId('category-tile-count')).toBeNull();
  });

  it('renders the SYNCED pill when isSynced is true', () => {
    const {getByTestId, getByText} = renderTile({isSynced: true});

    expect(getByTestId('category-tile-synced')).toBeTruthy();
    expect(getByText('SYNCED')).toBeTruthy();
  });

  it('does not render the SYNCED pill by default', () => {
    const {queryByTestId, queryByText} = renderTile();

    expect(queryByTestId('category-tile-synced')).toBeNull();
    expect(queryByText('SYNCED')).toBeNull();
  });

  it('applies containerStyle to the tile', () => {
    const customStyle = {marginBottom: 12};
    const {getByTestId} = renderTile({containerStyle: customStyle});

    const root = getByTestId('category-tile');
    expect(root.props.style).toEqual(expect.arrayContaining([customStyle]));
  });

  it('honours a custom testID for the tile and its sub-elements', () => {
    const {getByTestId} = renderTile({
      testID: 'admin-tile',
      count: 3,
      isSynced: true,
    });

    expect(getByTestId('admin-tile')).toBeTruthy();
    expect(getByTestId('admin-tile-count')).toBeTruthy();
    expect(getByTestId('admin-tile-synced')).toBeTruthy();
  });
});
