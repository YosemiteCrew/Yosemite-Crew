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
};

const TitleCalendar = ({
  activeCalendar,
  title,
  setActiveCalendar,
  setAddPopup,
  currentDate,
  setCurrentDate,
}: TitleCalendarProps) => {
  return (
    <div className="flex justify-between items-center w-full">
      <div className="font-grotesk font-medium text-black-text text-[33px]">
        {title}
      </div>
      <div className="flex gap-3 items-center">
        <Primary
          href="#"
          text="Add"
          classname="w-[140px] sm:w-40"
          onClick={() => setAddPopup(true)}
        />
        <Datepicker currentDate={currentDate} setCurrentDate={setCurrentDate} placeholder="Select Date" />
        <div className="flex items-center rounded-2xl">
          <button
            onClick={() => setActiveCalendar("vet")}
            className={`${activeCalendar === "vet" ? "border-blue-text! bg-[#EAF3FF]" : "border-grey-light!"} rounded-l-2xl! border! px-3 py-3 hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] transition-all duration-300 ease-in-out`}
          >
            <BsCalendar2DateFill
              size={30}
              color={activeCalendar === "vet" ? "#247AED" : "#302f2e"}
            />
          </button>
          <button
            onClick={() => setActiveCalendar("week")}
            className={`${activeCalendar === "week" ? "border-blue-text! bg-[#EAF3FF]" : "border-grey-light!"} border! px-3 py-3 hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] transition-all duration-300 ease-in-out`}
          >
            <BsCalendar2DayFill
              size={30}
              color={activeCalendar === "week" ? "#247AED" : "#302f2e"}
            />
          </button>
          <button
            onClick={() => setActiveCalendar("day")}
            className={`${activeCalendar === "day" ? "border-blue-text! bg-[#EAF3FF]" : "border-grey-light!"} rounded-r-2xl! border! px-3 py-3 hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] transition-all duration-300 ease-in-out`}
          >
            <FaUser
              size={28}
              color={activeCalendar === "day" ? "#247AED" : "#302f2e"}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TitleCalendar;
