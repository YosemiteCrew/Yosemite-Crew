import React from "react";
import { Primary } from "@/app/components/Buttons";
import { BsCalendar2DateFill, BsCalendar2DayFill } from "react-icons/bs";
import { FaUser } from "react-icons/fa6";
import Datepicker from "../Inputs/Datepicker";

type TitleCalendarProps = {
  activeCalendar: string;
  title: string;
  setActiveCalendar: React.Dispatch<React.SetStateAction<string>>;
  setAddPopup: React.Dispatch<React.SetStateAction<boolean>>;
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  count: number;
};

const TitleCalendar = ({
  activeCalendar,
  title,
  setActiveCalendar,
  setAddPopup,
  currentDate,
  setCurrentDate,
  count
}: TitleCalendarProps) => {
  return (
    <div className="flex justify-between items-center w-full flex-wrap gap-3">
      <div className="text-text-primary text-heading-1">
        {title}
        <span className="text-text-tertiary">
          {" (" + count + ")"}
        </span>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <Primary href="#" text="Add" onClick={() => setAddPopup(true)} />
        <Datepicker
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          placeholder="Select Date"
        />
        <div className="flex items-center rounded-2xl">
          <button
            onClick={() => setActiveCalendar("vet")}
            className={`${activeCalendar === "vet" ? "border-blue-text! bg-[#EAF3FF]" : "border-grey-light!"} rounded-l-2xl! border! px-[13px] py-[13px] hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] transition-all duration-300 ease-in-out`}
          >
            <BsCalendar2DateFill
              size={20}
              color={activeCalendar === "vet" ? "#247AED" : "#302f2e"}
            />
          </button>
          <button
            onClick={() => setActiveCalendar("week")}
            className={`${activeCalendar === "week" ? "border-blue-text! bg-[#EAF3FF]" : "border-grey-light!"} border! px-[13px] py-[13px] hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] transition-all duration-300 ease-in-out`}
          >
            <BsCalendar2DayFill
              size={20}
              color={activeCalendar === "week" ? "#247AED" : "#302f2e"}
            />
          </button>
          <button
            onClick={() => setActiveCalendar("day")}
            className={`${activeCalendar === "day" ? "border-blue-text! bg-[#EAF3FF]" : "border-grey-light!"} rounded-r-2xl! border! px-[13px] py-[13px] hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] transition-all duration-300 ease-in-out`}
          >
            <FaUser
              size={18}
              color={activeCalendar === "day" ? "#247AED" : "#302f2e"}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TitleCalendar;
