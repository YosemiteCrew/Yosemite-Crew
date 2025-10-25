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
      {showDatePicker && (
        <SimpleDatePicker
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          selectedDate={formData.date}
          onConfirm={(date) => {
            updateField('date', date);
            setShowDatePicker(false);
          }}
          mode="date"
        />
      )}

      {/* Main task time picker */}
      {showTimePicker && (
        <SimpleDatePicker
          visible={showTimePicker}
          onClose={() => setShowTimePicker(false)}
          selectedDate={formData.time || new Date()}
          onConfirm={(date) => {
            updateField('time', date);
            setShowTimePicker(false);
          }}
          mode="time"
        />
      )}

      {/* Medication start date picker */}
      {showStartDatePicker && (
        <SimpleDatePicker
          visible={showStartDatePicker}
          onClose={() => setShowStartDatePicker(false)}
          selectedDate={formData.startDate}
          onConfirm={(date) => {
            updateField('startDate', date);
            setShowStartDatePicker(false);
          }}
          mode="date"
        />
      )}

      {/* Medication end date picker */}
      {showEndDatePicker && (
        <SimpleDatePicker
          visible={showEndDatePicker}
          onClose={() => setShowEndDatePicker(false)}
          selectedDate={formData.endDate || new Date()}
          onConfirm={(date) => {
            updateField('endDate', date);
            setShowEndDatePicker(false);
          }}
          mode="date"
        />
      )}
    </>
  );
};
