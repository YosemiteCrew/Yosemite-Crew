import React from "react";
import { Primary } from "@/app/components/Buttons";
import Datepicker from "../Inputs/Datepicker";
import Dropdown from "../Inputs/Dropdown";

type TitleCalendarProps = {
  activeCalendar: string;
  title: string;
  description?: string;
  setActiveCalendar: React.Dispatch<React.SetStateAction<string>>;
  setAddPopup: React.Dispatch<React.SetStateAction<boolean>>;
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  count: number;
};

const TitleCalendar = ({
  activeCalendar,
  title,
  description,
  setActiveCalendar,
  setAddPopup,
  currentDate,
  setCurrentDate,
  count,
}: TitleCalendarProps) => {
  return (
    <div className="flex justify-between items-center w-full flex-wrap gap-3">
      <div className="flex flex-col gap-1">
        <div className="text-text-primary text-heading-1">
          {title}
          <span className="text-text-tertiary">{" (" + count + ")"}</span>
        </div>
        {description ? (
          <p className="text-body-3 text-text-secondary max-w-3xl">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <Primary href="#" text="Add" onClick={() => setAddPopup(true)} />
        <Datepicker
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          placeholder="Select Date"
        />
        <Dropdown
          options={[
            { key: "day", label: "Day" },
            { key: "week", label: "Week" },
            { key: "team", label: "Team" },
          ]}
          placeholder="View"
          defaultOption={activeCalendar}
          onSelect={(option) => setActiveCalendar(option.key)}
        />
      </div>
    </div>
  );
};

export default TitleCalendar;
