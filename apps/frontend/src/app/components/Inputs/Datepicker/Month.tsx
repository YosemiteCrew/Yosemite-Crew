import React from "react";
import DatepickerDropdown from "./DatepickerDropdown";

type MonthProps = {
  viewMonth: number;
  monthNames: string[];
  setViewMonth: React.Dispatch<React.SetStateAction<number>>;
};

const Month = ({ viewMonth, monthNames, setViewMonth }: MonthProps) => {
  return (
    <DatepickerDropdown
      value={viewMonth}
      options={monthNames.map((_, i) => i)}
      onSelect={setViewMonth}
      widthClassName="w-[100px]"
      formatOption={(option) => monthNames[option]}
    />
  );
};

export default Month;
