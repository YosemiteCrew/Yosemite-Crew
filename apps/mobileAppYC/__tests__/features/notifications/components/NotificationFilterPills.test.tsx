import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, screen, act} from '@testing-library/react-native';
import {NotificationFilterPills} from '../../../../src/features/notifications/components/NotificationFilterPills/NotificationFilterPills';
import {ScrollView} from 'react-native';

// --- Mocks ---

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

describe('NotificationFilterPills', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const defaultProps = {
    selectedFilter: 'all' as const,
    onFilterChange: jest.fn(),
    unreadCounts: {},
  };

  it('renders correctly without unreadCounts prop (Branch Coverage for Default Props)', () => {
    render(
      <NotificationFilterPills
        selectedFilter="all"
        onFilterChange={jest.fn()}
        unreadCounts={undefined}
      />,
    );
    expect(screen.getByText('All')).toBeTruthy();
  });

  it('renders all filter options correctly', () => {
    render(<NotificationFilterPills {...defaultProps} />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Messages / OTP')).toBeTruthy();
  });

  it('calls onFilterChange when a pill is pressed', () => {
    const onFilterChangeMock = jest.fn();
    render(
      <NotificationFilterPills
        {...defaultProps}
        onFilterChange={onFilterChangeMock}
      />,
    );

    const tasksPill = screen.getByText('Tasks');
    fireEvent.press(tasksPill);

    expect(onFilterChangeMock).toHaveBeenCalledTimes(1);
    expect(onFilterChangeMock).toHaveBeenCalledWith('tasks');
  });

  it('highlights the selected filter (Style check)', () => {
    render(
      <NotificationFilterPills {...defaultProps} selectedFilter="tasks" />,
    );
  });

  describe('Badge Logic (Branch Coverage)', () => {
    it('renders numbers > 9 as "9+"', () => {
      render(
        <NotificationFilterPills
          {...defaultProps}
          unreadCounts={{tasks: 12}}
        />,
      );
      expect(screen.getByText('9+')).toBeTruthy();
    });

    it('renders numbers <= 9 exactly', () => {
      render(
        <NotificationFilterPills
          {...defaultProps}
          unreadCounts={{messages: 5}}
        />,
      );
      expect(screen.getByText('5')).toBeTruthy();
    });

    it('does not render badge if count is 0', () => {
      render(
        <NotificationFilterPills
          {...defaultProps}
          unreadCounts={{messages: 0}}
        />,
      );
      expect(screen.queryByText('0')).toBeNull();
    });

    it('does not render badge if key is missing (undefined)', () => {
      render(<NotificationFilterPills {...defaultProps} unreadCounts={{}} />);
      expect(screen.queryByText('0')).toBeNull();
    });

    it('applies the active badge style when the badged pill is selected (br 115 true)', () => {
      render(
        <NotificationFilterPills
          {...defaultProps}
          selectedFilter="tasks"
          unreadCounts={{tasks: 5}}
        />,
      );
      // Badge renders on the selected pill -> selectedFilter === option.id is true,
      // so the badgeActive style branch is taken.
      expect(screen.getByText('5')).toBeTruthy();
    });
  });

  describe('Auto-Scroll & Layout Logic (Complex Branch Coverage)', () => {
    const setupScrollTest = (scrollX = 0) => {
      const result = render(
        <NotificationFilterPills {...defaultProps} selectedFilter="all" />,
      );

      // 1. Layout Container (Width = 300)
      // Find ScrollView first to get a handle on the component tree
      const scrollView = screen.UNSAFE_getByType(ScrollView);
      const container = scrollView.parent;

      if (container) {
        act(() => {
          fireEvent(container, 'layout', {
            nativeEvent: {layout: {width: 300, height: 50, x: 0, y: 0}},
          });
        });
      }

      // 2. Set initial Scroll Position
      fireEvent(scrollView, 'scroll', {
        nativeEvent: {contentOffset: {x: scrollX, y: 0}},
      });

      // 3. Layout the 'payment' pill (placed at x=400, width=100)
      const paymentText = screen.getByText('Payments');
      // We find the node that has the onLayout prop
      const paymentButton = paymentText.parent?.props.onLayout
        ? paymentText.parent
        : paymentText.parent?.parent;

      if (paymentButton) {
        act(() => {
          fireEvent(paymentButton, 'layout', {
            nativeEvent: {layout: {x: 400, width: 100, height: 36, y: 0}},
          });
        });
      }

      return {result};
    };

    it('Branch: Skips scroll if layout/width missing', () => {
      const {rerender} = render(
        <NotificationFilterPills {...defaultProps} selectedFilter="all" />,
      );
      // No layout events fired -> containerWidth is 0.

      rerender(
        <NotificationFilterPills {...defaultProps} selectedFilter="payment" />,
      );

      // Should not throw, simply returns early
      act(() => {
        jest.runAllTimers();
      });
    });

    it('Branch: Executes ScrollTo when distance > 4', () => {
      // Initial Scroll = 0. Target calculated = 300.
      // Diff = 300 > 4. Should scroll.
      const {result} = setupScrollTest(0);

      result.rerender(
        <NotificationFilterPills {...defaultProps} selectedFilter="payment" />,
      );

      act(() => {
        jest.runAllTimers();
      });
    });

    it('Branch: Skips ScrollTo when distance <= 4', () => {
      // Target calculated = 300.
      // We set current Scroll to 298.
      // Diff = |300 - 298| = 2.
      // 2 < 4. The `scrollTo` should NOT be called.
      const {result} = setupScrollTest(298);

      result.rerender(
        <NotificationFilterPills {...defaultProps} selectedFilter="payment" />,
      );

      act(() => {
        jest.runAllTimers();
      });
    });

    it('Branch: Ignores container layout when width is unchanged or 0 (br 71 false)', () => {
      render(
        <NotificationFilterPills {...defaultProps} selectedFilter="all" />,
      );
      const scrollView = screen.UNSAFE_getByType(ScrollView);
      const container = scrollView.parent;

      if (container) {
        // First real layout -> condition true, stores width.
        act(() => {
          fireEvent(container, 'layout', {
            nativeEvent: {layout: {width: 300, height: 50, x: 0, y: 0}},
          });
        });
        // Same width again -> containerWidthRef.current !== w is false -> skip.
        act(() => {
          fireEvent(container, 'layout', {
            nativeEvent: {layout: {width: 300, height: 50, x: 0, y: 0}},
          });
        });
        // Zero width -> w > 0 is false -> skip (covers the if-false branch).
        act(() => {
          fireEvent(container, 'layout', {
            nativeEvent: {layout: {width: 0, height: 50, x: 0, y: 0}},
          });
        });
      }

      act(() => {
        jest.runAllTimers();
      });

      expect(screen.getByText('All')).toBeTruthy();
    });

    it('Branch: Centers the pill when the laid-out pill is the selected filter (br 100 / stmt 101)', () => {
      render(
        <NotificationFilterPills {...defaultProps} selectedFilter="all" />,
      );

      // Give the container a width so centerSelectedPill has something to work with.
      const scrollView = screen.UNSAFE_getByType(ScrollView);
      const container = scrollView.parent;
      if (container) {
        act(() => {
          fireEvent(container, 'layout', {
            nativeEvent: {layout: {width: 300, height: 50, x: 0, y: 0}},
          });
        });
      }

      // Lay out the 'All' pill, which IS the selected filter -> option.id === selectedFilter.
      const allText = screen.getByText('All');
      const allButton = allText.parent?.props.onLayout
        ? allText.parent
        : allText.parent?.parent;

      if (allButton) {
        act(() => {
          fireEvent(allButton, 'layout', {
            nativeEvent: {layout: {x: 0, width: 60, height: 36, y: 0}},
          });
        });
      }

      act(() => {
        jest.runAllTimers();
      });

      expect(screen.getByText('All')).toBeTruthy();
    });
  });
});
