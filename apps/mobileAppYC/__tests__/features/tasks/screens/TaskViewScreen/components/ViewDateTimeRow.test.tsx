import React from 'react';
import {render} from '@testing-library/react-native';
// Fixed path: 6 levels up to root, then into src
import {ViewDateTimeRow} from '../../../../../../src/features/tasks/screens/TaskViewScreen/components/ViewDateTimeRow';

// --- Mocks ---

// Mock the shared detail-row component (ViewTouchField) so we can assert the
// exact props ViewDateTimeRow forwards to each stacked row.
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
  };

  beforeEach(() => {
    MockViewTouchField.mockClear();
  });

  it('renders the date and time as two stacked detail rows', () => {
    const {getByTestId, getByText} = render(<ViewDateTimeRow {...mockProps} />);

    // Both stacked rows render via the mocked ViewTouchField
    expect(getByTestId('view-field-Date')).toBeTruthy();
    expect(getByTestId('view-field-Time')).toBeTruthy();

    // Labels + values are surfaced
    expect(getByText('Date')).toBeTruthy();
    expect(getByText('2023-10-27')).toBeTruthy();
    expect(getByText('Time')).toBeTruthy();
    expect(getByText('10:00 AM')).toBeTruthy();

    // Exactly two detail rows are rendered
    expect(MockViewTouchField).toHaveBeenCalledTimes(2);
  });

  it('passes the date label and value to the first detail row', () => {
    render(<ViewDateTimeRow {...mockProps} />);

    // The date row now only receives label + value (no icon/style props)
    expect(MockViewTouchField).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Date',
        value: '2023-10-27',
      }),
    );
  });

  it('passes the time label and value to the second detail row', () => {
    render(<ViewDateTimeRow {...mockProps} />);

    // The time row now only receives label + value (no icon/style props)
    expect(MockViewTouchField).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Time',
        value: '10:00 AM',
      }),
    );
  });

  it('renders custom labels and values passed via props', () => {
    const {getByTestId, getByText} = render(
      <ViewDateTimeRow
        dateLabel="Due date"
        dateValue="Tomorrow"
        timeLabel="Reminder"
        timeValue="9:30 AM"
      />,
    );

    expect(getByTestId('view-field-Due date')).toBeTruthy();
    expect(getByTestId('view-field-Reminder')).toBeTruthy();
    expect(getByText('Tomorrow')).toBeTruthy();
    expect(getByText('9:30 AM')).toBeTruthy();

    expect(MockViewTouchField).toHaveBeenCalledWith(
      expect.objectContaining({label: 'Due date', value: 'Tomorrow'}),
    );
    expect(MockViewTouchField).toHaveBeenCalledWith(
      expect.objectContaining({label: 'Reminder', value: '9:30 AM'}),
    );
  });
});
