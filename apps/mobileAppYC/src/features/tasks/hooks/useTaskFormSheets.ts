import {useEffect, useRef} from 'react';
import {useBottomSheetBackHandler} from '@/hooks';

interface UseTaskFormSheetsReturn {
  taskTypeSheetRef: React.RefObject<any>;
  medicationTypeSheetRef: React.RefObject<any>;
  dosageSheetRef: React.RefObject<any>;
  medicationFrequencySheetRef: React.RefObject<any>;
  taskFrequencySheetRef: React.RefObject<any>;
  assignTaskSheetRef: React.RefObject<any>;
  calendarSyncSheetRef: React.RefObject<any>;
  observationalToolSheetRef: React.RefObject<any>;
  discardSheetRef: React.RefObject<any>;
  openTaskSheet: (sheet: string) => void;
  closeTaskSheet: () => void;
}

export const useTaskFormSheets = (): UseTaskFormSheetsReturn => {
  const taskTypeSheetRef = useRef<any>(null);
  const medicationTypeSheetRef = useRef<any>(null);
  const dosageSheetRef = useRef<any>(null);
  const medicationFrequencySheetRef = useRef<any>(null);
  const taskFrequencySheetRef = useRef<any>(null);
  const assignTaskSheetRef = useRef<any>(null);
  const calendarSyncSheetRef = useRef<any>(null);
  const observationalToolSheetRef = useRef<any>(null);
  const discardSheetRef = useRef<any>(null);

  const {registerSheet, openSheet, closeSheet} = useBottomSheetBackHandler();

  useEffect(() => {
    registerSheet('task-type', taskTypeSheetRef);
    registerSheet('medication-type', medicationTypeSheetRef);
    registerSheet('dosage', dosageSheetRef);
    registerSheet('medication-frequency', medicationFrequencySheetRef);
    registerSheet('task-frequency', taskFrequencySheetRef);
    registerSheet('assign-task', assignTaskSheetRef);
    registerSheet('calendar-sync', calendarSyncSheetRef);
    registerSheet('observational-tool', observationalToolSheetRef);
    registerSheet('discard-task', discardSheetRef);
  }, [registerSheet]);

  return {
    taskTypeSheetRef,
    medicationTypeSheetRef,
    dosageSheetRef,
    medicationFrequencySheetRef,
    taskFrequencySheetRef,
    assignTaskSheetRef,
    calendarSyncSheetRef,
    observationalToolSheetRef,
    discardSheetRef,
    openTaskSheet: openSheet,
    closeTaskSheet: closeSheet,
  };
};
