import React from 'react';
import {SimpleDatePicker} from '@/shared/components/common/SimpleDatePicker/SimpleDatePicker';
import type {TaskFormData} from '@/features/tasks/types';

export interface TaskDatePickerControl {
  visible: boolean;
  setVisible: (value: boolean) => void;
}

export interface TaskDatePickerControls {
  date: TaskDatePickerControl;
  time: TaskDatePickerControl;
  startDate: TaskDatePickerControl;
  endDate: TaskDatePickerControl;
}

interface TaskDatePickersProps {
  pickerControls: TaskDatePickerControls;
  formData: TaskFormData;
  updateField: <K extends keyof TaskFormData>(
    field: K,
    value: TaskFormData[K],
  ) => void;
}

export const TaskDatePickers: React.FC<TaskDatePickersProps> = ({
  pickerControls,
  formData,
  updateField,
}) => {
  const {date, time, startDate, endDate} = pickerControls;

  return (
    <>
      {/* Main task date picker */}
      <SimpleDatePicker
        show={date.visible}
        onDismiss={() => date.setVisible(false)}
        value={formData.date}
        onDateChange={(selectedDate: Date) => {
          updateField('date', selectedDate);
          date.setVisible(false);
        }}
        mode="date"
      />

      {/* Main task time picker */}
      <SimpleDatePicker
        show={time.visible}
        onDismiss={() => time.setVisible(false)}
        value={formData.time || new Date()}
        onDateChange={(selectedDate: Date) => {
          updateField('time', selectedDate);
          time.setVisible(false);
        }}
        mode="time"
      />

      {/* Medication start date picker */}
      <SimpleDatePicker
        show={startDate.visible}
        onDismiss={() => startDate.setVisible(false)}
        value={formData.startDate}
        onDateChange={(selectedDate: Date) => {
          updateField('startDate', selectedDate);
          startDate.setVisible(false);
        }}
        mode="date"
      />

      {/* Medication end date picker */}
      <SimpleDatePicker
        show={endDate.visible}
        onDismiss={() => endDate.setVisible(false)}
        value={formData.endDate || new Date()}
        onDateChange={(selectedDate: Date) => {
          updateField('endDate', selectedDate);
          endDate.setVisible(false);
        }}
        mode="date"
      />
    </>
  );
};
