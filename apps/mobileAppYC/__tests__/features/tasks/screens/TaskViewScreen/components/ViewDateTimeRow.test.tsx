import React from 'react';
import {render} from '@testing-library/react-native';
// Fixed path: 6 levels up to root, then into src
import {ViewDateTimeRow} from '../../../../../../src/features/tasks/screens/TaskViewScreen/components/ViewDateTimeRow';

// --- Mocks ---

// 1. Mock Assets
jest.mock('@/assets/images', () => ({
  Images: {
    calendarIcon: {uri: 'calendar-icon-uri'},
    clockIcon: {uri: 'clock-icon-uri'},
  },
}));

// 2. Mock Child Component (ViewTouchField)
// We verify props passed to it by rendering them or checking call arguments
const MockViewTouchField = jest.fn((props: any) => {
  const {View, Text} = require('react-native');
  return (
    <View testID={`view-field-${props.label}`}>
      <Text>{props.label}</Text>
      <Text>{props.value}</Text>
    </View>
  );
});

// This mocks the relative import './ViewField' inside ViewDateTimeRow.tsx
// Fixed path: 6 levels up to root, then into src
jest.mock(
  '../../../../../../src/features/tasks/screens/TaskViewScreen/components/ViewField',
  () => ({
    ViewTouchField: (props: any) => MockViewTouchField(props),
  }),
);

describe('ViewDateTimeRow', () => {
  const mockProps = {
    dateLabel: 'Date',
    dateValue: '2023-10-27',
    timeLabel: 'Time',
    timeValue: '10:00 AM',
    dateTimeRowStyle: {flexDirection: 'row'},
    dateTimeFieldStyle: {flex: 1},
    calendarIconStyle: {width: 20},
    clockIconStyle: {width: 20},
  };

  beforeEach(() => {
    MockViewTouchField.mockClear();
  });

  it('renders correctly with given props', () => {
    const {getByTestId, getByText} = render(<ViewDateTimeRow {...mockProps} />);

    // Ensure both fields are rendered via our mock
    expect(getByTestId('view-field-Date')).toBeTruthy();
    expect(getByTestId('view-field-Time')).toBeTruthy();

    // Verify values are displayed
    expect(getByText('2023-10-27')).toBeTruthy();
    expect(getByText('10:00 AM')).toBeTruthy();
  });

  it('passes correct props to Date field', () => {
    render(<ViewDateTimeRow {...mockProps} />);

    // Check if the mock was called with the correct props for Date
    expect(MockViewTouchField).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Date',
        value: '2023-10-27',
        // We expect the mocked image object
        icon: expect.objectContaining({uri: 'calendar-icon-uri'}),
        iconStyle: mockProps.calendarIconStyle,
        fieldGroupStyle: mockProps.dateTimeFieldStyle,
      }),
    );
  });

  it('passes correct props to Time field', () => {
    render(<ViewDateTimeRow {...mockProps} />);

    // Check if the mock was called with the correct props for Time
    expect(MockViewTouchField).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Time',
        value: '10:00 AM',
        // We expect the mocked image object
        icon: expect.objectContaining({uri: 'clock-icon-uri'}),
        iconStyle: mockProps.clockIconStyle,
        fieldGroupStyle: mockProps.dateTimeFieldStyle,
      }),
    );
  });
});
