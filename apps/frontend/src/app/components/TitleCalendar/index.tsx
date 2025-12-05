import React from "react";
import { Primary } from "@/app/components/Buttons";
import { IoCalendarClear } from "react-icons/io5";
import { BsCalendar2DateFill, BsCalendar2DayFill } from "react-icons/bs";
import { FaUser } from "react-icons/fa6";

type TitleCalendarProps = {
  activeCalendar: number;
  title: string;
  setActiveCalendar: any;
  setAddPopup: any;
};

const TitleCalendar = ({
  activeCalendar,
  title,
  setActiveCalendar,
  setAddPopup,
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
        <button className="rounded-2xl! border! border-grey-light! px-3 py-3 hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] transition-all duration-300 ease-in-out">
          <IoCalendarClear size={30} color="#302f2e" />
        </button>
        <div className="flex items-center rounded-2xl">
          <button
            onClick={() => setActiveCalendar(0)}
            className={`${activeCalendar === 0 ? "border-blue-text! bg-[#EAF3FF]" : "border-grey-light!"} rounded-l-2xl! border! px-3 py-3 hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] transition-all duration-300 ease-in-out`}
          >
            <BsCalendar2DateFill
              size={30}
              color={activeCalendar === 0 ? "#247AED" : "#302f2e"}
            />
          </button>
          <button
            onClick={() => setActiveCalendar(1)}
            className={`${activeCalendar === 1 ? "border-blue-text! bg-[#EAF3FF]" : "border-grey-light!"} border! px-3 py-3 hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] transition-all duration-300 ease-in-out`}
          >
            <BsCalendar2DayFill
              size={30}
              color={activeCalendar === 1 ? "#247AED" : "#302f2e"}
            />
          </button>
          <button
            onClick={() => setActiveCalendar(2)}
            className={`${activeCalendar === 2 ? "border-blue-text! bg-[#EAF3FF]" : "border-grey-light!"} rounded-r-2xl! border! px-3 py-3 hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] transition-all duration-300 ease-in-out`}
          >
            <FaUser
              size={28}
              color={activeCalendar === 2 ? "#247AED" : "#302f2e"}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TitleCalendar;
