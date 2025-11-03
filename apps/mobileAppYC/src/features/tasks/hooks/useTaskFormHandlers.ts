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
  openTaskSheet: (sheet: string) => void;
  closeTaskSheet: () => void;
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
  openTaskSheet,
  closeTaskSheet,
}: UseTaskFormHandlersProps) => {
  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      openTaskSheet('discard-task');
      discardSheetRef.current?.open();
    } else {
      navigation.goBack();
    }
  }, [hasUnsavedChanges, discardSheetRef, navigation, openTaskSheet]);

  const sheetHandlers = {
    onOpenMedicationTypeSheet: () => {
      openTaskSheet('medication-type');
      medicationTypeSheetRef.current?.open();
    },
    onOpenDosageSheet: () => {
      openTaskSheet('dosage');
      dosageSheetRef.current?.open();
    },
    onOpenMedicationFrequencySheet: () => {
      openTaskSheet('medication-frequency');
      medicationFrequencySheetRef.current?.open();
    },
    onOpenStartDatePicker: () => setShowStartDatePicker(true),
    onOpenEndDatePicker: () => setShowEndDatePicker(true),
    onOpenObservationalToolSheet: () => {
      openTaskSheet('observational-tool');
      observationalToolSheetRef.current?.open();
    },
    onOpenDatePicker: () => setShowDatePicker(true),
    onOpenTimePicker: () => setShowTimePicker(true),
    onOpenTaskFrequencySheet: () => {
      openTaskSheet('task-frequency');
      taskFrequencySheetRef.current?.open();
    },
    onOpenAssignTaskSheet: () => {
      openTaskSheet('assign-task');
      assignTaskSheetRef.current?.open();
    },
    onOpenCalendarSyncSheet: () => {
      openTaskSheet('calendar-sync');
      calendarSyncSheetRef.current?.open();
    },
    closeTaskSheet,
  };

  return {
    handleBack,
    sheetHandlers,
  };
};
