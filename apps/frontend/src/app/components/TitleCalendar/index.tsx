import React from "react";
import { Primary } from "@/app/components/Buttons";
import Datepicker from "../Inputs/Datepicker";
import Dropdown from "../Inputs/Dropdown";
import { IoIosCalendar } from "react-icons/io";
import { MdTaskAlt } from "react-icons/md";

type TitleCalendarProps = {
  activeCalendar: string;
  title: string;
  description?: string;
  setActiveCalendar: React.Dispatch<React.SetStateAction<string>>;
  setAddPopup: React.Dispatch<React.SetStateAction<boolean>>;
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  count: number;
  activeView: string;
  setActiveView: React.Dispatch<React.SetStateAction<string>>;
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
  activeView,
  setActiveView,
}: TitleCalendarProps) => {
  return (
    <div className="flex justify-between items-center w-full flex-wrap gap-3">
      <div className="flex flex-col gap-1">
        <div className="text-text-primary text-heading-1">
          {title}
          <span className="text-text-tertiary">{" (" + count + ")"}</span>
        </div>
        {description ? (
          <p className="text-body-3 text-text-secondary max-w-lg">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <Primary href="#" text="Add" onClick={() => setAddPopup(true)} />
        {activeView === "calendar" && (
          <>
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
          </>
        )}
        <div className="flex rounded-2xl">
          <button
            onClick={() => setActiveView("calendar")}
            className={`${activeView === "calendar" ? "border-text-brand! bg-blue-light! border-r" : "border-card-border! hover:bg-card-hover!"} border px-6 py-[11px] rounded-l-2xl! transition-all duration-300 bg-white flex items-center justify-center`}
          >
            <IoIosCalendar
              size={24}
              className={`${activeView === "calendar" ? "text-text-brand" : "text-text-primary"}`}
            />
          </button>
          <button
            onClick={() => setActiveView("list")}
            className={`${activeView === "list" ? "border-text-brand! bg-blue-light! border-l" : "border-card-border! hover:bg-card-hover!"} border-y border-r px-6 py-[11px] rounded-r-2xl! hover:bg-card-hover! transition-all duration-300 bg-white flex items-center justify-center`}
          >
            <MdTaskAlt
              size={24}
              className={`${activeView === "list" ? "text-text-brand" : "text-text-primary"}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TitleCalendar;
