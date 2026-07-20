import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {ScrollView, StyleSheet, FlatList} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import {
  PillSelector,
  PillOption,
} from '../../../src/shared/components/common/PillSelector/PillSelector';

// --- Mocks ---

// Mock useTheme hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
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

    expect(selectedStyle.color).toBe(mockTheme.colors.primary);
    expect(inactiveStyle.color).toBe(mockTheme.colors.text);
  });

  // ===========================================================================
  // 3b. Accessibility
  // ===========================================================================

  it('exposes the selected state to screen readers via accessibilityState', () => {
    const {getByLabelText} = render(<PillSelector {...defaultProps} />);

    const selected = getByLabelText('Option 1');
    expect(selected.props.accessibilityRole).toBe('radio');
    expect(selected.props.accessibilityState).toEqual({selected: true});

    const unselected = getByLabelText('Option 2');
    expect(unselected.props.accessibilityRole).toBe('radio');
    expect(unselected.props.accessibilityState).toEqual({selected: false});
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

  // ===========================================================================
  // 6. AutoScroll (FlatList) mode
  // ===========================================================================

  describe('autoScroll mode', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('renders a FlatList when autoScroll is true', () => {
      const {UNSAFE_getByType} = render(
        <PillSelector {...defaultProps} autoScroll />,
      );
      expect(UNSAFE_getByType(FlatList)).toBeTruthy();
    });

    it('renders each option via renderItem and calls onSelect when pressed', () => {
      const {getByText} = render(<PillSelector {...defaultProps} autoScroll />);
      fireEvent.press(getByText('Option 2'));
      expect(defaultProps.onSelect).toHaveBeenCalledWith('2');
    });

    it('passes initialScrollIndex based on the selected option, or undefined if not found', () => {
      const {UNSAFE_getByType, rerender} = render(
        <PillSelector {...defaultProps} autoScroll selectedId="2" />,
      );
      expect(UNSAFE_getByType(FlatList).props.initialScrollIndex).toBe(1);

      rerender(
        <PillSelector {...defaultProps} autoScroll selectedId="not-found" />,
      );
      expect(
        UNSAFE_getByType(FlatList).props.initialScrollIndex,
      ).toBeUndefined();
    });

    it('computes getItemLayout using the fixed item width and pillSpacing/theme gap', () => {
      const {UNSAFE_getByType} = render(
        <PillSelector {...defaultProps} autoScroll pillSpacing={10} />,
      );
      const {getItemLayout} = UNSAFE_getByType(FlatList).props;

      expect(getItemLayout(null, 2)).toEqual({
        length: 120,
        offset: 2 * (120 + 10),
        index: 2,
      });
    });

    it('warns via onScrollToIndexFailed without throwing', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const {UNSAFE_getByType} = render(
        <PillSelector {...defaultProps} autoScroll />,
      );
      const {onScrollToIndexFailed} = UNSAFE_getByType(FlatList).props;

      expect(() =>
        onScrollToIndexFailed({
          index: 1,
          highestMeasuredFrameIndex: 0,
          averageItemLength: 120,
        }),
      ).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith('ScrollToIndex failed:', 1);

      warnSpy.mockRestore();
    });

    it('does not schedule a scroll when the selected option is not found', () => {
      const scrollToIndexSpy = jest.fn();
      const {UNSAFE_getByType} = render(
        <PillSelector {...defaultProps} autoScroll selectedId="missing" />,
      );
      (UNSAFE_getByType(FlatList) as any).instance = {
        scrollToIndex: scrollToIndexSpy,
      };

      expect(() => jest.advanceTimersByTime(500)).not.toThrow();
      expect(scrollToIndexSpy).not.toHaveBeenCalled();
    });

    it('schedules two scrollToIndex calls (initial + retry) when a valid selection exists', () => {
      const scrollToIndexSpy = jest.fn();
      jest
        .spyOn(FlatList.prototype as any, 'scrollToIndex')
        .mockImplementation(scrollToIndexSpy);

      render(<PillSelector {...defaultProps} autoScroll selectedId="2" />);

      expect(() => jest.advanceTimersByTime(100)).not.toThrow();
      expect(scrollToIndexSpy).toHaveBeenCalledWith(
        expect.objectContaining({index: 1, viewPosition: 0.5, animated: true}),
      );

      expect(() => jest.advanceTimersByTime(300)).not.toThrow();
      expect(scrollToIndexSpy).toHaveBeenCalledTimes(2);

      (FlatList.prototype as any).scrollToIndex.mockRestore();
    });

    it('does not scroll after the ref is cleared by an unmount before the timer fires', () => {
      const scrollToIndexSpy = jest.fn();
      jest
        .spyOn(FlatList.prototype as any, 'scrollToIndex')
        .mockImplementation(scrollToIndexSpy);

      const {unmount} = render(
        <PillSelector {...defaultProps} autoScroll selectedId="2" />,
      );
      unmount();

      expect(() => jest.advanceTimersByTime(500)).not.toThrow();
      expect(scrollToIndexSpy).not.toHaveBeenCalled();

      (FlatList.prototype as any).scrollToIndex.mockRestore();
    });
  });
});
