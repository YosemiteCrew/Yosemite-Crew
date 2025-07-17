"use client";
import React, { useState, useEffect } from 'react';
import './DynamicDatePicker.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FormControl } from 'react-bootstrap';
import { FaCalendarAlt } from 'react-icons/fa';

// TypeScript interface for props
interface DynamicDatePickerProps {
  placeholder: string;
  onDateChange: (date: string | null) => void;
  value?: string | null;
  minDate?: Date | null;
  maxDate?: Date | null;
}

const DynamicDatePicker: React.FC<DynamicDatePickerProps> = ({
  placeholder,
  onDateChange,
  value = null,
  minDate = null,
  maxDate = null,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    value ? new Date(value) : null
  );

  useEffect(() => {
    if (value) {
      setSelectedDate(new Date(value));
    }
  }, [value]);

  const handleDateChange = (date: Date | null) => {
    setSelectedDate(date);
    const formattedDate = date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          '0'
        )}-${String(date.getDate()).padStart(2, '0')}`
      : null;
    onDateChange(formattedDate);
  };

  return (
    <div className="DatePicDiv">
      <FormControl
        as="div"
        style={{ cursor: 'pointer' }}
        onClick={(e) => e.preventDefault()}
      >
        <DatePicker
          selected={selectedDate}
          onChange={handleDateChange}
          placeholderText={placeholder}
          dateFormat="yyyy-MM-dd"
          minDate={minDate || undefined}
          maxDate={maxDate || undefined}
        />
      </FormControl>
      <FaCalendarAlt />
    </div>
  );
};

export default DynamicDatePicker;

