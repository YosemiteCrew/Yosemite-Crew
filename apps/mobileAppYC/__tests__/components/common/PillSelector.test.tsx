import React from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import {
  PillSelector,
  PillOption,
} from '../../../src/shared/components/common/PillSelector/PillSelector';

// --- Mocks ---

// Mock useTheme hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#000000',
        white: '#ffffff',
        primary: '#0000ff',
        lightBlueBackground: '#e6f7ff',
      },
      spacing: {
        '1': 4,
        '1.25': 5,
        '2': 8,
        '4': 16,
      },
      borderRadius: {
        md: 8,
        full: 999,
      },
      typography: {
        pillSubtitleBold15: {fontSize: 15, fontWeight: 'bold'},
        captionBold: {fontSize: 12, fontWeight: 'bold'},
      },
    },
  }),
}));

describe('PillSelector Component', () => {
  const mockOptions: PillOption[] = [
    {id: '1', label: 'Option 1'},
    {id: '2', label: 'Option 2', badgeCount: 5},
    {id: '3', label: 'Option 3', badgeCount: 0}, // Badge should not show
  ];

  const defaultProps = {
    options: mockOptions,
    selectedId: '1',
    onSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering Logic
  // ===========================================================================

  it('renders all options correctly', () => {
    const {getByText} = render(<PillSelector {...defaultProps} />);
    expect(getByText('Option 1')).toBeTruthy();
    expect(getByText('Option 2')).toBeTruthy();
    expect(getByText('Option 3')).toBeTruthy();
  });

  it('renders badges only when count is greater than 0', () => {
    const {getByText, queryByText} = render(<PillSelector {...defaultProps} />);
    // Option 2 has badgeCount: 5
    expect(getByText('5')).toBeTruthy();
    // Option 3 has badgeCount: 0 -> Should NOT render
    expect(queryByText('0')).toBeNull();
  });

  // ===========================================================================
  // 2. Interaction
  // ===========================================================================

  it('calls onSelect with the correct ID when a pill is pressed', () => {
    const {getByText} = render(<PillSelector {...defaultProps} />);

    fireEvent.press(getByText('Option 2'));
    expect(defaultProps.onSelect).toHaveBeenCalledTimes(1);
    expect(defaultProps.onSelect).toHaveBeenCalledWith('2');
  });

  // ===========================================================================
  // 3. Styling & Active State
  // ===========================================================================

  it('applies active styles to the selected pill', () => {
    // Option 1 is selected by defaultProps
    const {getByText} = render(<PillSelector {...defaultProps} />);

    const selectedText = getByText('Option 1');
    const inactiveText = getByText('Option 2');

    // Check Text Styles (Active vs Inactive)
    // Note: Style is usually an array. We flatten or check properties.
    const selectedStyle = StyleSheet.flatten(selectedText.props.style);
    const inactiveStyle = StyleSheet.flatten(inactiveText.props.style);

    expect(selectedStyle.color).toBe('#0000ff'); // active color
    expect(inactiveStyle.color).toBe('#000000'); // default text color
  });

  // ===========================================================================
  // 4. Scroll vs Static Layout (Branch Coverage)
  // ===========================================================================

  it('renders a ScrollView when allowScroll is true (default)', () => {
    const {UNSAFE_getByType} = render(
      <PillSelector {...defaultProps} allowScroll={true} />,
    );
    expect(UNSAFE_getByType(ScrollView)).toBeTruthy();
  });

  it('renders a plain View (static container) when allowScroll is false', () => {
    const {UNSAFE_queryByType} = render(
      <PillSelector {...defaultProps} allowScroll={false} />,
    );
    // Should NOT find a ScrollView
    expect(UNSAFE_queryByType(ScrollView)).toBeNull();
  });

  // ===========================================================================
  // 5. Custom Styles & Props
  // ===========================================================================

  it('applies custom containerStyle', () => {
    const customStyle = {backgroundColor: 'red'};
    const {UNSAFE_getByType} = render(
      <PillSelector {...defaultProps} containerStyle={customStyle} />,
    );
    const scrollView = UNSAFE_getByType(ScrollView);
    const flatStyle = StyleSheet.flatten(scrollView.props.style);
    expect(flatStyle).toMatchObject(expect.objectContaining(customStyle));
  });

  it('applies custom contentStyle (to ScrollView contentContainerStyle)', () => {
    const customContentStyle = {paddingLeft: 20};
    const {UNSAFE_getByType} = render(
      <PillSelector {...defaultProps} contentStyle={customContentStyle} />,
    );
    const scrollView = UNSAFE_getByType(ScrollView);
    const flatStyle = StyleSheet.flatten(
      scrollView.props.contentContainerStyle,
    );
    expect(flatStyle).toMatchObject(
      expect.objectContaining(customContentStyle),
    );
  });

  it('applies custom pillSpacing to gap style (Static mode)', () => {
    const customSpacing = 12;
    // We test static mode to verify columnGap/rowGap application easily
    const {toJSON} = render(
      <PillSelector
        {...defaultProps}
        allowScroll={false}
        pillSpacing={customSpacing}
      />,
    );

    const root = toJSON();
    // @ts-ignore
    const style = StyleSheet.flatten(root?.props?.style);

    // staticContainer uses columnGap and rowGap in your component
    expect(style).toHaveProperty('columnGap', customSpacing);
    expect(style).toHaveProperty('rowGap', customSpacing);
  });

  it('applies custom pillSpacing to gap style (Scroll mode)', () => {
    const customSpacing = 15;
    const {UNSAFE_getByType} = render(
      <PillSelector
        {...defaultProps}
        allowScroll={true}
        pillSpacing={customSpacing}
      />,
    );

    const scrollView = UNSAFE_getByType(ScrollView);
    const flatStyle = StyleSheet.flatten(
      scrollView.props.contentContainerStyle,
    );

    // scrollContent uses gap
    expect(flatStyle).toHaveProperty('gap', customSpacing);
  });
});
