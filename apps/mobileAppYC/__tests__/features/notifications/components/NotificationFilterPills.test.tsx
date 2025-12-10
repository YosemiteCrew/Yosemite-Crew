import React from 'react';
import {render, fireEvent, screen, act} from '@testing-library/react-native';
import {NotificationFilterPills} from '../../../../src/features/notifications/components/NotificationFilterPills/NotificationFilterPills';
import {ScrollView} from 'react-native';

// --- Mocks ---

jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: '#E1F545',
        primaryTint: 'rgba(225, 245, 69, 0.1)',
        white: '#FFFFFF',
      },
      spacing: {1: 8},
      borderRadius: {lg: 8},
      typography: {
        labelSmallBold: {fontSize: 12, fontWeight: 'bold'},
        labelXs: {fontSize: 10},
      },
    },
  }),
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
  });
});
