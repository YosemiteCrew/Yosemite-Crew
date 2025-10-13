import React from 'react';
import TestRenderer from 'react-test-renderer';
import {SimpleDatePicker, formatDateForDisplay} from '@/components/common/SimpleDatePicker/SimpleDatePicker';

// Mock the date picker component
jest.mock('@react-native-community/datetimepicker', () => {
  return ({value, onChange, mode}: any) => {
    const MockReact = require('react');
    const {View: MockView} = require('react-native');
    return MockReact.createElement(MockView, {
      testID: 'date-time-picker',
      'data-value': value,
      'data-mode': mode,
      onPress: () => onChange({type: 'set'}, new Date('2024-01-15')),
    });
  };
});

describe('SimpleDatePicker', () => {
  const mockDate = new Date('2024-01-01');

  it('should not render when show is false', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <SimpleDatePicker
          value={mockDate}
          onDateChange={() => {}}
          show={false}
          onDismiss={() => {}}
        />
      );
    });

    expect(tree.toJSON()).toBeNull();
  });

  it('should render when show is true', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <SimpleDatePicker
          value={mockDate}
          onDateChange={() => {}}
          show={true}
          onDismiss={() => {}}
        />
      );
    });

    expect(tree.toJSON()).not.toBeNull();
  });

  it('should use provided value', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <SimpleDatePicker
          value={mockDate}
          onDateChange={() => {}}
          show={true}
          onDismiss={() => {}}
        />
      );
    });

    const picker = tree.root.findByProps({testID: 'date-time-picker'});
    expect(picker).toBeTruthy();
  });

  it('should default to date mode', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <SimpleDatePicker
          value={mockDate}
          onDateChange={() => {}}
          show={true}
          onDismiss={() => {}}
        />
      );
    });

    const picker = tree.root.findByProps({testID: 'date-time-picker'});
    expect(picker.props['data-mode']).toBe('date');
  });

  it('should support time mode', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <SimpleDatePicker
          value={mockDate}
          onDateChange={() => {}}
          show={true}
          onDismiss={() => {}}
          mode="time"
        />
      );
    });

    const picker = tree.root.findByProps({testID: 'date-time-picker'});
    expect(picker.props['data-mode']).toBe('time');
  });

  it('should support datetime mode', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <SimpleDatePicker
          value={mockDate}
          onDateChange={() => {}}
          show={true}
          onDismiss={() => {}}
          mode="datetime"
        />
      );
    });

    const picker = tree.root.findByProps({testID: 'date-time-picker'});
    expect(picker.props['data-mode']).toBe('datetime');
  });

  it('should handle null value by using current date', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <SimpleDatePicker
          value={null}
          onDateChange={() => {}}
          show={true}
          onDismiss={() => {}}
        />
      );
    });

    expect(tree.toJSON()).not.toBeNull();
  });
});

describe('formatDateForDisplay', () => {
  it('should format date correctly', () => {
    const date = new Date('2024-01-15');
    const formatted = formatDateForDisplay(date);
    expect(formatted).toBe('15-JAN-2024');
  });

  it('should return empty string for null', () => {
    const formatted = formatDateForDisplay(null);
    expect(formatted).toBe('');
  });

  it('should handle December correctly', () => {
    const date = new Date('2024-12-25');
    const formatted = formatDateForDisplay(date);
    expect(formatted).toBe('25-DEC-2024');
  });

  it('should handle single digit days with padding', () => {
    const date = new Date('2024-03-05');
    const formatted = formatDateForDisplay(date);
    expect(formatted).toBe('05-MAR-2024');
  });

  it('should handle all months correctly', () => {
    const months = [
      'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
    ];

    months.forEach((month, index) => {
      const date = new Date(2024, index, 15);
      const formatted = formatDateForDisplay(date);
      expect(formatted).toBe(`15-${month}-2024`);
    });
  });

  it('should return empty string for invalid date', () => {
    const invalidDate = new Date('invalid');
    const formatted = formatDateForDisplay(invalidDate);
    expect(formatted).toBe('');
  });
});
