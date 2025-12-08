import React from "react";
import { GrNext, GrPrevious } from "react-icons/gr";
import { getMonthYear } from "../helpers";

type Headerprops = {
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
};

const Header = ({ setCurrentDate, currentDate }: Headerprops) => {
  const goToNextMonth = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  const goToPrevMonth = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };
  return (
    <div>
      <div className="flex items-center justify-between px-2 py-2 border-b border-grey-light">
        <GrPrevious
          size={20}
          color="#302f2e"
          onClick={goToPrevMonth}
          className="cursor-pointer"
        />
        <div className="font-grotesk font-medium text-black-text text-[28px]">
          {getMonthYear(currentDate)}
        </div>
        <GrNext
          size={20}
          color="#302f2e"
          onClick={goToNextMonth}
          className="cursor-pointer"
        />
      </div>
    </div>
  );
};

export default Header;
