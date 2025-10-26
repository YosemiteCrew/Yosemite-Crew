import {useCallback} from 'react';

interface UseTaskFormHandlersProps {
  hasUnsavedChanges: boolean;
  discardSheetRef: React.RefObject<any>;
  navigation: any;
  medicationTypeSheetRef: React.RefObject<any>;
  dosageSheetRef: React.RefObject<any>;
  medicationFrequencySheetRef: React.RefObject<any>;
  observationalToolSheetRef: React.RefObject<any>;
  taskFrequencySheetRef: React.RefObject<any>;
  assignTaskSheetRef: React.RefObject<any>;
  calendarSyncSheetRef: React.RefObject<any>;
  setShowDatePicker: (value: boolean) => void;
  setShowTimePicker: (value: boolean) => void;
  setShowStartDatePicker: (value: boolean) => void;
  setShowEndDatePicker: (value: boolean) => void;
}

export const useTaskFormHandlers = ({
  hasUnsavedChanges,
  discardSheetRef,
  navigation,
  medicationTypeSheetRef,
  dosageSheetRef,
  medicationFrequencySheetRef,
  observationalToolSheetRef,
  taskFrequencySheetRef,
  assignTaskSheetRef,
  calendarSyncSheetRef,
  setShowDatePicker,
  setShowTimePicker,
  setShowStartDatePicker,
  setShowEndDatePicker,
}: UseTaskFormHandlersProps) => {
  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      discardSheetRef.current?.open();
    } else {
      navigation.goBack();
    }
  }, [hasUnsavedChanges, discardSheetRef, navigation]);

  const sheetHandlers = {
    onOpenMedicationTypeSheet: () => medicationTypeSheetRef.current?.open(),
    onOpenDosageSheet: () => dosageSheetRef.current?.open(),
    onOpenMedicationFrequencySheet: () => medicationFrequencySheetRef.current?.open(),
    onOpenStartDatePicker: () => setShowStartDatePicker(true),
    onOpenEndDatePicker: () => setShowEndDatePicker(true),
    onOpenObservationalToolSheet: () => observationalToolSheetRef.current?.open(),
    onOpenDatePicker: () => setShowDatePicker(true),
    onOpenTimePicker: () => setShowTimePicker(true),
    onOpenTaskFrequencySheet: () => taskFrequencySheetRef.current?.open(),
    onOpenAssignTaskSheet: () => assignTaskSheetRef.current?.open(),
    onOpenCalendarSyncSheet: () => calendarSyncSheetRef.current?.open(),
  };

  return {
    handleBack,
    sheetHandlers,
  };
};
