import React from 'react';
import {render, act} from '@testing-library/react-native';
import {TaskDatePickers} from '@/features/tasks/components/form/TaskDatePickers';
import {SimpleDatePicker} from '@/shared/components/common/SimpleDatePicker/SimpleDatePicker';
import type {TaskFormData} from '@/features/tasks/types';

// --- Mocks ---

// Mock the SimpleDatePicker dependency
jest.mock(
  '@/shared/components/common/SimpleDatePicker/SimpleDatePicker',
  () => ({
    SimpleDatePicker: jest.fn(() => null),
  }),
);

// Typecast the mock for test usage
const MockSimpleDatePicker = SimpleDatePicker as jest.Mock;

// --- Test Setup ---

// Mock functions for props
const mockUpdateField = jest.fn();
const mockSetShowDatePicker = jest.fn();
const mockSetShowTimePicker = jest.fn();
const mockSetShowStartDatePicker = jest.fn();
const mockSetShowEndDatePicker = jest.fn();

// Create a comprehensive mock TaskFormData that satisfies the type
const mockFormData: TaskFormData = {
  // BaseTaskFormData
  category: 'custom',
  subcategory: null,
  parasitePreventionType: null,
  chronicConditionType: null,
  healthTaskType: null,
  hygieneTaskType: null,
  dietaryTaskType: null,
  title: 'Test Task',
  date: new Date('2025-10-30T00:00:00.000Z'),
  time: new Date('2025-10-30T10:30:00.000Z'),
  frequency: 'daily',
  assignedTo: null,
  reminderEnabled: false,
  reminderOptions: null,
  syncWithCalendar: false,
  calendarProvider: null,
  attachDocuments: false,
  attachments: [],
  additionalNote: '',
  // MedicationFormData
  medicineName: '',
  medicineType: null,
  dosages: [],
  medicationFrequency: null,
  startDate: new Date('2025-11-01T00:00:00.000Z'),
  endDate: new Date('2025-11-30T00:00:00.000Z'),
  // ObservationalToolFormData
  observationalTool: null,
  // TaskFormData
  description: '',
};

// Mock formData with null dates to test fallbacks
const mockFormDataWithNulls: TaskFormData = {
  ...mockFormData,
  date: null,
  time: null,
  startDate: null,
  endDate: null,
};

// Helper to render the component
const renderComponent = (
  props: Partial<React.ComponentProps<typeof TaskDatePickers>>,
) => {
  const defaultProps: React.ComponentProps<typeof TaskDatePickers> = {
    showDatePicker: false,
    setShowDatePicker: mockSetShowDatePicker,
    showTimePicker: false,
    setShowTimePicker: mockSetShowTimePicker,
    showStartDatePicker: false,
    setShowStartDatePicker: mockSetShowStartDatePicker,
    showEndDatePicker: false,
    setShowEndDatePicker: mockSetShowEndDatePicker,
    formData: mockFormData,
    updateField: mockUpdateField,
  };

  render(<TaskDatePickers {...defaultProps} {...props} />);
};

// Fake timers to control `new Date()`
const FAKE_NOW = '2025-10-30T12:00:00.000Z';
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(FAKE_NOW));
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  // Clear all mock calls before each test
  jest.clearAllMocks();
  MockSimpleDatePicker.mockClear();
});

describe('TaskDatePickers', () => {
  it('renders all four pickers with show=false by default', () => {
    renderComponent({});

    // Expect 4 pickers to be rendered (but hidden)
    expect(MockSimpleDatePicker).toHaveBeenCalledTimes(4);

    // Check that all 'show' props are false
    expect(MockSimpleDatePicker.mock.calls[0][0].show).toBe(false); // DatePicker
    expect(MockSimpleDatePicker.mock.calls[1][0].show).toBe(false); // TimePicker
    expect(MockSimpleDatePicker.mock.calls[2][0].show).toBe(false); // StartDatePicker
    expect(MockSimpleDatePicker.mock.calls[3][0].show).toBe(false); // EndDatePicker
  });

  it('passes show=true to the correct picker', () => {
    renderComponent({showDatePicker: true, showStartDatePicker: true});

    expect(MockSimpleDatePicker.mock.calls[0][0].show).toBe(true); // DatePicker
    expect(MockSimpleDatePicker.mock.calls[1][0].show).toBe(false); // TimePicker
    expect(MockSimpleDatePicker.mock.calls[2][0].show).toBe(true); // StartDatePicker
    expect(MockSimpleDatePicker.mock.calls[3][0].show).toBe(false); // EndDatePicker
  });

  it('passes correct props to the main DatePicker', () => {
    renderComponent({showDatePicker: true});
    const props = MockSimpleDatePicker.mock.calls[0][0];

    expect(props.show).toBe(true);
    expect(props.mode).toBe('date');
    expect(props.value).toBe(mockFormData.date);
  });

  it('passes correct props to the main TimePicker (with value)', () => {
    renderComponent({showTimePicker: true});
    const props = MockSimpleDatePicker.mock.calls[1][0];

    expect(props.show).toBe(true);
    expect(props.mode).toBe('time');
    expect(props.value).toBe(mockFormData.time);
  });

  it('passes correct props to the StartDatePicker (with value)', () => {
    renderComponent({showStartDatePicker: true});
    const props = MockSimpleDatePicker.mock.calls[2][0];

    expect(props.show).toBe(true);
    expect(props.mode).toBe('date');
    expect(props.value).toBe(mockFormData.startDate);
  });

  it('passes correct props to the EndDatePicker (with value)', () => {
    renderComponent({showEndDatePicker: true});
    const props = MockSimpleDatePicker.mock.calls[3][0];

    expect(props.show).toBe(true);
    expect(props.mode).toBe('date');
    expect(props.value).toBe(mockFormData.endDate);
  });

  it('uses fallback new Date() for null time and end date values', () => {
    renderComponent({
      formData: mockFormDataWithNulls,
      showTimePicker: true,
      showEndDatePicker: true,
    });

    const timePickerProps = MockSimpleDatePicker.mock.calls[1][0];
    const endDatePickerProps = MockSimpleDatePicker.mock.calls[3][0];

    expect(timePickerProps.value).toEqual(new Date(FAKE_NOW));
    expect(endDatePickerProps.value).toEqual(new Date(FAKE_NOW));

    // Check that start/date pickers correctly use null
    const datePickerProps = MockSimpleDatePicker.mock.calls[0][0];
    const startDatePickerProps = MockSimpleDatePicker.mock.calls[2][0];
    expect(datePickerProps.value).toBeNull();
    expect(startDatePickerProps.value).toBeNull();
  });

  it('handles onDismiss for DatePicker', () => {
    renderComponent({showDatePicker: true});
    const props = MockSimpleDatePicker.mock.calls[0][0];

    act(() => props.onDismiss());
    expect(mockSetShowDatePicker).toHaveBeenCalledWith(false);
  });

  it('handles onDateChange for DatePicker', () => {
    renderComponent({showDatePicker: true});
    const props = MockSimpleDatePicker.mock.calls[0][0];
    const newDate = new Date('2026-01-01T00:00:00.000Z');

    act(() => props.onDateChange(newDate));
    expect(mockUpdateField).toHaveBeenCalledWith('date', newDate);
    expect(mockSetShowDatePicker).toHaveBeenCalledWith(false);
  });

  it('handles onDismiss for TimePicker', () => {
    renderComponent({showTimePicker: true});
    const props = MockSimpleDatePicker.mock.calls[1][0];

    act(() => props.onDismiss());
    expect(mockSetShowTimePicker).toHaveBeenCalledWith(false);
  });

  it('handles onDateChange for TimePicker', () => {
    renderComponent({showTimePicker: true});
    const props = MockSimpleDatePicker.mock.calls[1][0];
    const newTime = new Date('2026-01-01T14:00:00.000Z');

    act(() => props.onDateChange(newTime));
    expect(mockUpdateField).toHaveBeenCalledWith('time', newTime);
    expect(mockSetShowTimePicker).toHaveBeenCalledWith(false);
  });

  it('handles onDismiss for StartDatePicker', () => {
    renderComponent({showStartDatePicker: true});
    const props = MockSimpleDatePicker.mock.calls[2][0];

    act(() => props.onDismiss());
    expect(mockSetShowStartDatePicker).toHaveBeenCalledWith(false);
  });

  it('handles onDateChange for StartDatePicker', () => {
    renderComponent({showStartDatePicker: true});
    const props = MockSimpleDatePicker.mock.calls[2][0];
    const newDate = new Date('2026-02-01T00:00:00.000Z');

    act(() => props.onDateChange(newDate));
    expect(mockUpdateField).toHaveBeenCalledWith('startDate', newDate);
    expect(mockSetShowStartDatePicker).toHaveBeenCalledWith(false);
  });

  it('handles onDismiss for EndDatePicker', () => {
    renderComponent({showEndDatePicker: true});
    const props = MockSimpleDatePicker.mock.calls[3][0];

    act(() => props.onDismiss());
    expect(mockSetShowEndDatePicker).toHaveBeenCalledWith(false);
  });

  it('handles onDateChange for EndDatePicker', () => {
    renderComponent({showEndDatePicker: true});
    const props = MockSimpleDatePicker.mock.calls[3][0];
    const newDate = new Date('2026-03-01T00:00:00.000Z');

    act(() => props.onDateChange(newDate));
    expect(mockUpdateField).toHaveBeenCalledWith('endDate', newDate);
    expect(mockSetShowEndDatePicker).toHaveBeenCalledWith(false);
  });
});
