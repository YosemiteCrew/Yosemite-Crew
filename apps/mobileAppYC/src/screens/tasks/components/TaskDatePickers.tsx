import React from 'react';
import {SimpleDatePicker} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
import type {TaskFormData} from '@/features/tasks/types';

interface TaskDatePickersProps {
  showDatePicker: boolean;
  setShowDatePicker: (value: boolean) => void;
  showTimePicker: boolean;
  setShowTimePicker: (value: boolean) => void;
  showStartDatePicker: boolean;
  setShowStartDatePicker: (value: boolean) => void;
  showEndDatePicker: boolean;
  setShowEndDatePicker: (value: boolean) => void;
  formData: TaskFormData;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
}

export const TaskDatePickers: React.FC<TaskDatePickersProps> = ({
  showDatePicker,
  setShowDatePicker,
  showTimePicker,
  setShowTimePicker,
  showStartDatePicker,
  setShowStartDatePicker,
  showEndDatePicker,
  setShowEndDatePicker,
  formData,
  updateField,
}) => {
  return (
    <>
      {/* Main task date picker */}
      <SimpleDatePicker
        show={showDatePicker}
        onDismiss={() => setShowDatePicker(false)}
        value={formData.date}
        onDateChange={(date: Date) => {
          updateField('date', date);
          setShowDatePicker(false);
        }}
        mode="date"
      />

      {/* Main task time picker */}
      <SimpleDatePicker
        show={showTimePicker}
        onDismiss={() => setShowTimePicker(false)}
        value={formData.time || new Date()}
        onDateChange={(date: Date) => {
          updateField('time', date);
          setShowTimePicker(false);
        }}
        mode="time"
      />

      {/* Medication start date picker */}
      <SimpleDatePicker
        show={showStartDatePicker}
        onDismiss={() => setShowStartDatePicker(false)}
        value={formData.startDate}
        onDateChange={(date: Date) => {
          updateField('startDate', date);
          setShowStartDatePicker(false);
        }}
        mode="date"
      />

      {/* Medication end date picker */}
      <SimpleDatePicker
        show={showEndDatePicker}
        onDismiss={() => setShowEndDatePicker(false)}
        value={formData.endDate || new Date()}
        onDateChange={(date: Date) => {
          updateField('endDate', date);
          setShowEndDatePicker(false);
        }}
        mode="date"
      />
    </>
  );
};
