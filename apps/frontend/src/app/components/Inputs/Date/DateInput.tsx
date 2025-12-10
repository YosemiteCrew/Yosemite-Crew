import React, { forwardRef } from "react";
import DatePicker from "react-datepicker";

import "react-datepicker/dist/react-datepicker.css";

type CustomInputProps = {
  value?: string;
  onClick?: () => void;
  className?: string;
};

type DateInputProps = {
  value: Date | null;
  onChange: (date: Date | null) => void;
};

const CustomInput = forwardRef<HTMLButtonElement, CustomInputProps>(
  ({ value, onClick, className }, ref) => (
    <button className={className} onClick={onClick} ref={ref}>
      {value}
    </button>
  )
);

const DateInput = ({ value, onChange }: DateInputProps) => {
  return (
    <div className="w-full">
      <DatePicker
        selected={value}
        onChange={(date) => onChange(date)}
        wrapperClassName="w-full"
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        customInput={
          <CustomInput className="font-satoshi text-left! font-semibold text-black-text text-[18px] h-12! border! border-black-text! w-full! rounded-2xl! px-6! py-2.5!" />
        }
      />
    </div>
  );
};

export default DateInput;
