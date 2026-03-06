import React from 'react';
import {
  MedicationTypeBottomSheet,
  DosageBottomSheet,
  MedicationFrequencyBottomSheet,
  TaskFrequencyBottomSheet,
  AssignTaskBottomSheet,
  CalendarSyncBottomSheet,
  ObservationalToolBottomSheet,
  TaskTypeBottomSheet,
} from '@/features/tasks/components';
import {UploadDocumentBottomSheet} from '@/shared/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';
import {DeleteDocumentBottomSheet} from '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {DiscardChangesBottomSheet} from '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';
import type {TaskFormData} from '@/features/tasks/types';
import type {TaskBottomSheetHandlers, TaskSheetRefs, TaskTypeSheetProps} from './taskSheetTypes';

interface TaskBottomSheetsProps {
  formData: TaskFormData;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
  companionType: string;
  fileToDelete: string | null;
  refs: TaskSheetRefs;
  handlers: TaskBottomSheetHandlers;
  taskTypeSheetProps?: TaskTypeSheetProps;
}

export const TaskBottomSheets: React.FC<TaskBottomSheetsProps> = ({
  formData,
  updateField,
  companionType,
  fileToDelete,
  refs,
  handlers,
  taskTypeSheetProps,
}) => {
  // Helper to wrap handler with closeSheet call
  const withClose = (handler: () => void) => () => {
    handler();
    handlers.closeSheet();
  };

  const handleSheetChange = (index: number) => {
    if (index === -1) {
      handlers.closeTaskSheet();
    }
  };

  return (
    <>
      {taskTypeSheetProps && refs.taskTypeSheetRef && (
        <TaskTypeBottomSheet
          ref={refs.taskTypeSheetRef}
          selectedTaskType={taskTypeSheetProps.selectedTaskType}
          onSelect={selection => {
            taskTypeSheetProps.onSelect(selection);
            handlers.closeTaskSheet();
          }}
          onSheetChange={handleSheetChange}
        />
      )}

      <MedicationTypeBottomSheet
        ref={refs.medicationTypeSheetRef}
        selectedType={formData.medicineType}
        onSelect={type => {
          updateField('medicineType', type);
          handlers.closeTaskSheet();
        }}
        onSheetChange={handleSheetChange}
      />

      <DosageBottomSheet
        ref={refs.dosageSheetRef}
        dosages={formData.dosages}
        onSave={dosages => {
          updateField('dosages', dosages);
          handlers.closeTaskSheet();
        }}
        onSheetChange={handleSheetChange}
      />

      <MedicationFrequencyBottomSheet
        ref={refs.medicationFrequencySheetRef}
        selectedFrequency={formData.medicationFrequency}
        onSelect={frequency => {
          updateField('medicationFrequency', frequency);
          handlers.closeTaskSheet();
        }}
        onSheetChange={handleSheetChange}
      />

      <TaskFrequencyBottomSheet
        ref={refs.taskFrequencySheetRef}
        selectedFrequency={formData.frequency}
        onSelect={frequency => {
          updateField('frequency', frequency);
          handlers.closeTaskSheet();
        }}
        onSheetChange={handleSheetChange}
      />

      <AssignTaskBottomSheet
        ref={refs.assignTaskSheetRef}
        selectedUserId={formData.assignedTo}
        onSelect={userId => {
          updateField('assignedTo', userId);
          handlers.closeTaskSheet();
        }}
        onSheetChange={handleSheetChange}
      />

      <CalendarSyncBottomSheet
        ref={refs.calendarSyncSheetRef}
        selectedProvider={formData.calendarProvider}
        onSelect={(providerId, providerName) => {
          console.log('[TaskBottomSheets] Calendar selected:', {providerId, providerName});
          updateField('calendarProvider', providerId);
          updateField('calendarProviderName', providerName);
          handlers.closeTaskSheet();
        }}
        onSheetChange={handleSheetChange}
      />

      <ObservationalToolBottomSheet
        ref={refs.observationalToolSheetRef}
        selectedTool={formData.observationalTool}
        onSelect={tool => {
          updateField('observationalTool', tool);
          handlers.closeTaskSheet();
        }}
        companionType={companionType as any}
        onSheetChange={handleSheetChange}
      />

      <UploadDocumentBottomSheet
        ref={refs.uploadSheetRef}
        onTakePhoto={withClose(handlers.handleTakePhoto)}
        onChooseGallery={withClose(handlers.handleChooseFromGallery)}
        onUploadDrive={withClose(handlers.handleUploadFromDrive)}
      />

      <DeleteDocumentBottomSheet
        ref={refs.deleteSheetRef}
        documentTitle={
          fileToDelete
            ? formData.attachments.find(f => f.id === fileToDelete)?.name
            : 'this file'
        }
        onDelete={handlers.confirmDeleteFile}
      />

      <DiscardChangesBottomSheet
        ref={refs.discardSheetRef}
        onDiscard={() => {
          handlers.closeTaskSheet();
          handlers.onDiscard();
        }}
        onKeepEditing={handlers.closeTaskSheet}
        onSheetChange={handleSheetChange}
      />
    </>
  );
};
