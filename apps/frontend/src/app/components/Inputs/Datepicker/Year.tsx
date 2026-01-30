import React from "react";
import DatepickerDropdown from "./DatepickerDropdown";

type YearProps = {
  viewYear: number;
  years: number[];
  setViewYear: React.Dispatch<React.SetStateAction<number>>;
};

const Year = ({ viewYear, years, setViewYear }: YearProps) => {
  return (
    <DatepickerDropdown
      value={viewYear}
      options={years}
      onSelect={setViewYear}
      widthClassName="w-[70px]"
    />
  );
};

export default Year;
