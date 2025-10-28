import { renderHook } from '@testing-library/react-hooks';
import { useTaskFormSheets } from '@/hooks/useTaskFormSheets'; // Adjust path if needed

describe('useTaskFormSheets', () => {
  it('should initialize all sheet refs to null', () => {
    // Render the hook
    const { result } = renderHook(() => useTaskFormSheets());

    // FIXED: The hook returns a flat object, not one nested under 'refs'.
    // We get the refs directly from result.current.
    const refs = result.current;

    // Assert that all refs are created and their .current value is null
    expect(refs.taskTypeSheetRef.current).toBeNull();
    expect(refs.medicationTypeSheetRef.current).toBeNull();
    expect(refs.dosageSheetRef.current).toBeNull();
    expect(refs.medicationFrequencySheetRef.current).toBeNull();
    expect(refs.taskFrequencySheetRef.current).toBeNull();
    expect(refs.assignTaskSheetRef.current).toBeNull();
    expect(refs.calendarSyncSheetRef.current).toBeNull();
    expect(refs.observationalToolSheetRef.current).toBeNull();
    expect(refs.discardSheetRef.current).toBeNull();
    expect(refs.deleteSheetRef.current).toBeNull();
  });

  it('should return an object with all expected ref keys', () => {
    const { result } = renderHook(() => useTaskFormSheets());

    // Check that the hook's return object has the correct shape
    const expectedKeys = [
      'taskTypeSheetRef',
      'medicationTypeSheetRef',
      'dosageSheetRef',
      'medicationFrequencySheetRef',
      'taskFrequencySheetRef',
      'assignTaskSheetRef',
      'calendarSyncSheetRef',
      'observationalToolSheetRef',
      'discardSheetRef',
      'deleteSheetRef',
    ];

    // Verify all keys exist on the returned object
    expect(Object.keys(result.current)).toEqual(expectedKeys);
  });
});