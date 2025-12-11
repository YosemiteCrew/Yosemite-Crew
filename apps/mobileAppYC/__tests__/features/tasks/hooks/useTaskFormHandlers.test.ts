import {renderHook, act} from '@testing-library/react-native';
// Path: 4 levels up to project root
import {useTaskFormHandlers} from '../../../../src/features/tasks/hooks/useTaskFormHandlers';

describe('useTaskFormHandlers', () => {
  const mockNavigation = { goBack: jest.fn() };
  const mockOpenTaskSheet = jest.fn();
  const mockCloseTaskSheet = jest.fn();

  const mockRefs = {
    discardSheetRef: { current: { open: jest.fn() } },
    medicationTypeSheetRef: { current: { open: jest.fn() } },
    dosageSheetRef: { current: { open: jest.fn() } },
    medicationFrequencySheetRef: { current: { open: jest.fn() } },
    observationalToolSheetRef: { current: { open: jest.fn() } },
    taskFrequencySheetRef: { current: { open: jest.fn() } },
    assignTaskSheetRef: { current: { open: jest.fn() } },
    calendarSyncSheetRef: { current: { open: jest.fn() } },
  };

  const mockSetters = {
      setShowDatePicker: jest.fn(),
      setShowTimePicker: jest.fn(),
      setShowStartDatePicker: jest.fn(),
      setShowEndDatePicker: jest.fn(),
  };

  const defaultProps = {
    hasUnsavedChanges: false,
    navigation: mockNavigation,
    openTaskSheet: mockOpenTaskSheet,
    closeTaskSheet: mockCloseTaskSheet,
    ...mockRefs,
    ...mockSetters,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleBack', () => {
    it('navigates back immediately if no unsaved changes', () => {
      const { result } = renderHook(() => useTaskFormHandlers(defaultProps));

      act(() => {
          result.current.handleBack();
      });

      expect(mockNavigation.goBack).toHaveBeenCalled();
      expect(mockOpenTaskSheet).not.toHaveBeenCalled();
    });

    it('opens discard confirmation if there are unsaved changes', () => {
      const { result } = renderHook(() => useTaskFormHandlers({
          ...defaultProps,
          hasUnsavedChanges: true
      }));

      act(() => {
          result.current.handleBack();
      });

      expect(mockNavigation.goBack).not.toHaveBeenCalled();
      expect(mockOpenTaskSheet).toHaveBeenCalledWith('discard-task');
      expect(mockRefs.discardSheetRef.current.open).toHaveBeenCalled();
    });
  });

  describe('sheetHandlers', () => {
      // Helper to test sheet openers to reduce repetition
      const testSheetOpener = (
          handlerName: keyof typeof defaultProps | any,
          sheetName: string,
          refKey: keyof typeof mockRefs
      ) => {
          const { result } = renderHook(() => useTaskFormHandlers(defaultProps));
          const handler = result.current.sheetHandlers[handlerName as keyof typeof result.current.sheetHandlers];

          act(() => {
              // @ts-ignore - handler is function
              handler();
          });

          expect(mockOpenTaskSheet).toHaveBeenCalledWith(sheetName);
          expect(mockRefs[refKey].current.open).toHaveBeenCalled();
      };

      it('opens medication type sheet', () => {
          testSheetOpener('onOpenMedicationTypeSheet', 'medication-type', 'medicationTypeSheetRef');
      });

      it('opens dosage sheet', () => {
          testSheetOpener('onOpenDosageSheet', 'dosage', 'dosageSheetRef');
      });

      it('opens medication frequency sheet', () => {
          testSheetOpener('onOpenMedicationFrequencySheet', 'medication-frequency', 'medicationFrequencySheetRef');
      });

      it('opens observational tool sheet', () => {
          testSheetOpener('onOpenObservationalToolSheet', 'observational-tool', 'observationalToolSheetRef');
      });

      it('opens task frequency sheet', () => {
          testSheetOpener('onOpenTaskFrequencySheet', 'task-frequency', 'taskFrequencySheetRef');
      });

      it('opens assign task sheet', () => {
          testSheetOpener('onOpenAssignTaskSheet', 'assign-task', 'assignTaskSheetRef');
      });

      it('opens calendar sync sheet', () => {
          testSheetOpener('onOpenCalendarSyncSheet', 'calendar-sync', 'calendarSyncSheetRef');
      });

      it('calls closeTaskSheet directly', () => {
          const { result } = renderHook(() => useTaskFormHandlers(defaultProps));

          act(() => {
              result.current.sheetHandlers.closeTaskSheet();
          });

          expect(mockCloseTaskSheet).toHaveBeenCalled();
      });
  });

  describe('Picker Setters', () => {
      it('sets date picker state', () => {
          const { result } = renderHook(() => useTaskFormHandlers(defaultProps));
          act(() => result.current.sheetHandlers.onOpenDatePicker());
          expect(mockSetters.setShowDatePicker).toHaveBeenCalledWith(true);
      });

      it('sets time picker state', () => {
          const { result } = renderHook(() => useTaskFormHandlers(defaultProps));
          act(() => result.current.sheetHandlers.onOpenTimePicker());
          expect(mockSetters.setShowTimePicker).toHaveBeenCalledWith(true);
      });

      it('sets start date picker state', () => {
          const { result } = renderHook(() => useTaskFormHandlers(defaultProps));
          act(() => result.current.sheetHandlers.onOpenStartDatePicker());
          expect(mockSetters.setShowStartDatePicker).toHaveBeenCalledWith(true);
      });

      it('sets end date picker state', () => {
          const { result } = renderHook(() => useTaskFormHandlers(defaultProps));
          act(() => result.current.sheetHandlers.onOpenEndDatePicker());
          expect(mockSetters.setShowEndDatePicker).toHaveBeenCalledWith(true);
      });
  });
});