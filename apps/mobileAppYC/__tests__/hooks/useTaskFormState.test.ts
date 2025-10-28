import { renderHook, act } from '@testing-library/react-hooks';
import { useTaskFormState } from '@/hooks/useTaskFormState';
import type { TaskFormData, TaskFormErrors } from '@/features/tasks/types';

// Create a version of the default data *without* the fields that use new Date()
// This allows us to do a simple .toEqual() check on the rest of the object.
const DEFAULT_DATA_SANS_DATES: Omit<TaskFormData, 'date' | 'startDate'> = {
  category: null,
  subcategory: null,
  parasitePreventionType: null,
  chronicConditionType: null,
  healthTaskType: null,
  hygieneTaskType: null,
  dietaryTaskType: null,
  title: '',
  // date: new Date(), // Omitted
  time: null,
  frequency: null,
  assignedTo: null,
  reminderEnabled: false,
  reminderOptions: null,
  syncWithCalendar: false,
  calendarProvider: null,
  attachDocuments: false,
  attachments: [],
  additionalNote: '',
  medicineName: '',
  medicineType: null,
  dosages: [],
  medicationFrequency: null,
  // startDate: new Date(), // Omitted
  endDate: null,
  observationalTool: null,
  description: '',
};

// A static date for testing overrides
const testStartDate = new Date(2025, 1, 1); // Feb 1, 2025

describe('useTaskFormState', () => {
  beforeAll(() => {
    // We just need to enable fake timers, not set a specific time.
    // This ensures that new Date() inside the hook is consistent.
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('should initialize with default state when no initialData is provided', () => {
    const { result } = renderHook(() => useTaskFormState());

    // De-structure the dates from the rest of the form data
    const { date, startDate, ...restOfData } = result.current.formData;

    // 1. Check all non-date fields match the default
    expect(restOfData).toEqual(DEFAULT_DATA_SANS_DATES);
    // 2. Check that dates are valid Date objects (this avoids millisecond mismatch)
    expect(date).toEqual(expect.any(Date));
    expect(startDate).toEqual(expect.any(Date));

    // 3. Check other state variables
    expect(result.current.errors).toEqual({});
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.showDatePicker).toBe(false);
    expect(result.current.showTimePicker).toBe(false);
    expect(result.current.showStartDatePicker).toBe(false);
    expect(result.current.showEndDatePicker).toBe(false);
  });

  it('should initialize with merged state when initialData is provided', () => {
    const initialData: Partial<TaskFormData> = {
      title: 'My Initial Task',
      additionalNote: 'Initial note',
      startDate: testStartDate, // Use our static date
    };
    const { result } = renderHook(() => useTaskFormState(initialData));
    const { date, startDate, ...rest } = result.current.formData;

    // Check that fields are overridden
    expect(rest.title).toBe('My Initial Task');
    expect(rest.additionalNote).toBe('Initial note');
    // Check that our static date is used
    expect(startDate).toBe(testStartDate);
    // Check that the default date is still a valid Date
    expect(date).toEqual(expect.any(Date));
  });

  it('should update formData with setFormData', () => {
    const { result } = renderHook(() => useTaskFormState());
    // We must create a new object with the *correct* default dates from the hook
    const newFormData = { ...result.current.formData, title: 'New Full Form' };

    act(() => {
      result.current.setFormData(newFormData);
    });

    expect(result.current.formData).toEqual(newFormData);
  });

  it('should update errors with setErrors', () => {
    const { result } = renderHook(() => useTaskFormState());
    const newErrors: TaskFormErrors = { title: 'Is Required' };

    act(() => {
      result.current.setErrors(newErrors);
    });

    expect(result.current.errors).toEqual(newErrors);
  });

  it('should update hasUnsavedChanges with setHasUnsavedChanges', () => {
    const { result } = renderHook(() => useTaskFormState());
    act(() => {
      result.current.setHasUnsavedChanges(true);
    });
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('should update showDatePicker with setShowDatePicker', () => {
    const { result } = renderHook(() => useTaskFormState());
    act(() => {
      result.current.setShowDatePicker(true);
    });
    expect(result.current.showDatePicker).toBe(true);
  });

  it('should update showTimePicker with setShowTimePicker', () => {
    const { result } = renderHook(() => useTaskFormState());
    act(() => {
      result.current.setShowTimePicker(true);
    });
    expect(result.current.showTimePicker).toBe(true);
  });

  it('should update showStartDatePicker with setShowStartDatePicker', () => {
    const { result } = renderHook(() => useTaskFormState());
    act(() => {
      result.current.setShowStartDatePicker(true);
    });
    expect(result.current.showStartDatePicker).toBe(true);
  });

  it('should update showEndDatePicker with setShowEndDatePicker', () => {
    const { result } = renderHook(() => useTaskFormState());
    act(() => {
      result.current.setShowEndDatePicker(true);
    });
    expect(result.current.showEndDatePicker).toBe(true);
  });

  it('updateField should update a field, set unsaved changes, and clear errors', () => {
    const { result } = renderHook(() => useTaskFormState());

    // 1. Set an initial error
    act(() => {
      result.current.setErrors({ title: 'Old error', description: 'Desc error' });
    });
    expect(result.current.errors).toEqual({ title: 'Old error', description: 'Desc error' });

    // 2. Update the field
    act(() => {
      result.current.updateField('title', 'New Title');
    });

    // 3. Check all state changes
    expect(result.current.formData.title).toBe('New Title');
    expect(result.current.hasUnsavedChanges).toBe(true);
    // Should have cleared the error for 'title', but not 'description'
    expect(result.current.errors).toEqual({ description: 'Desc error' });
  });

  it('clearError should remove a single error', () => {
    const { result } = renderHook(() => useTaskFormState());
    const initialErrors: TaskFormErrors = { title: 'Error 1', description: 'Error 2' };

    act(() => {
      result.current.setErrors(initialErrors);
    });
    expect(result.current.errors).toEqual(initialErrors);

    act(() => {
      result.current.clearError('title');
    });

    expect(result.current.errors).toEqual({ description: 'Error 2' });
  });

  it('resetForm should reset all state to default when no initialData provided', () => {
    const { result } = renderHook(() => useTaskFormState());

    // 1. "Dirty" the state
    act(() => {
      result.current.updateField('title', 'Dirty Task');
      result.current.setErrors({ title: 'Some error' });
      result.current.setShowDatePicker(true);
      result.current.setShowTimePicker(true);
      result.current.setShowStartDatePicker(true);
      result.current.setShowEndDatePicker(true);
    });

    // 2. Reset the form
    act(() => {
      result.current.resetForm();
    });

    // 3. Check that state is back to default
    const { date, startDate, ...restOfData } = result.current.formData;
    expect(restOfData).toEqual(DEFAULT_DATA_SANS_DATES);
    expect(date).toEqual(expect.any(Date));
    expect(startDate).toEqual(expect.any(Date));

    expect(result.current.errors).toEqual({});
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.showDatePicker).toBe(false);
    expect(result.current.showTimePicker).toBe(false);
    expect(result.current.showStartDatePicker).toBe(false);
    expect(result.current.showEndDatePicker).toBe(false);
  });

  it('resetForm should reset all state to the merged initialData', () => {
    const initialData: Partial<TaskFormData> = {
      title: 'My Initial Task',
      startDate: testStartDate,
    };

    const { result } = renderHook(() => useTaskFormState(initialData));

    // 1. "Dirty" the state
    act(() => {
      result.current.updateField('title', 'Dirty Task');
      result.current.updateField('description', 'Dirty Description');
      result.current.setErrors({ title: 'Some error' });
      result.current.setShowDatePicker(true);
    });

    // 2. Reset the form
    act(() => {
      result.current.resetForm();
    });

    // 3. Check that state is back to the *initial* merged state
    const { date, startDate, ...rest } = result.current.formData;
    expect(rest.title).toBe('My Initial Task');
    expect(rest.description).toBe(''); // was default
    expect(startDate).toBe(testStartDate); // was initialData
    expect(date).toEqual(expect.any(Date)); // was default

    // Check that other states are reset
    expect(result.current.errors).toEqual({});
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.showDatePicker).toBe(false);
  });
});