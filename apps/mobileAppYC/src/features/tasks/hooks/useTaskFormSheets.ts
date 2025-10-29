import {useRef} from 'react';

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
  deleteSheetRef: React.RefObject<any>;
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
  const deleteSheetRef = useRef<any>(null);

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
    deleteSheetRef,
  };
};
