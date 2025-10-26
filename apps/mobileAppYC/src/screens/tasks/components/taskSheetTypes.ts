import type {TaskTypeSelection} from '@/features/tasks/types';

export interface TaskSheetRefs {
  medicationTypeSheetRef: React.RefObject<any>;
  dosageSheetRef: React.RefObject<any>;
  medicationFrequencySheetRef: React.RefObject<any>;
  taskFrequencySheetRef: React.RefObject<any>;
  assignTaskSheetRef: React.RefObject<any>;
  calendarSyncSheetRef: React.RefObject<any>;
  observationalToolSheetRef: React.RefObject<any>;
  uploadSheetRef: React.RefObject<any>;
  deleteSheetRef: React.RefObject<any>;
  discardSheetRef: React.RefObject<any>;
  taskTypeSheetRef?: React.RefObject<any>;
}

export interface TaskBottomSheetHandlers {
  handleTakePhoto: () => void;
  handleChooseFromGallery: () => void;
  handleUploadFromDrive: () => void;
  confirmDeleteFile: () => void;
  closeSheet: () => void;
  onDiscard: () => void;
}

export interface TaskTypeSheetProps {
  selectedTaskType: TaskTypeSelection | null;
  onSelect: (selection: TaskTypeSelection) => void;
}

