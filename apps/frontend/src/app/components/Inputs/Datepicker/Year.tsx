import React, { useEffect, useRef, useState } from "react";

type YearProps = {
  viewYear: number;
  years: number[];
  setViewYear: React.Dispatch<React.SetStateAction<number>>;
};

const Year = ({ viewYear, years, setViewYear }: YearProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const onSelectYear = (year: number) => {
    setViewYear(year);
    setOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((e) => !e)}
        className="text-[13px] font-satoshi font-semibold text-black-text border-none outline-none bg-white"
      >
        {viewYear}
      </button>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 mt-1 border border-grey-noti bg-white rounded-xl max-h-[200px] w-[70px] overflow-auto flex flex-col p-1 scrollbar-hidden">
          {years.map((year: number) => (
            <button
              className="py-1 outline-none bg-white text-[13px] font-satoshi font-semibold text-black-text"
              key={year}
              onClick={() => onSelectYear(year)}
            >
              {year}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Year;
