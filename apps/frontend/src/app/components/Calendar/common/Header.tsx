import React from "react";
import { getMonthYear } from "../helpers";

type Headerprops = {
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
};

const Header = ({ setCurrentDate, currentDate }: Headerprops) => {
  return (
    <div className="flex w-full items-center justify-center px-3 py-2 border-b border-grey-light">
      <div className="text-heading-2 text-text-primary">
        {getMonthYear(currentDate)}
      </div>
    </div>
  );
};

export default Header;
