"use client";
import React, { useEffect, useRef, useState } from "react";
import { FaAngleDown } from "react-icons/fa";

const CardHeader = ({ title, options }: any) => {
  const [selected, setSelected] = useState<string>(options[0]);
  const [open, setOpen] = useState<boolean>(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const handleSelect = (option: string) => {
    setSelected(option);
    setOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="flex items-center justify-between w-full ">
      <div className="text-body-1 text-text-primary">{title}</div>
      <div className="relative" ref={filterRef}>
        <button
          onClick={() => setOpen((e) => !e)}
          className="outline-none w-[140px] flex items-center justify-end gap-2 border-0 bg-white"
        >
          <span className="text-body-4 text-text-primary">{selected}</span>
          <FaAngleDown color="#302F2E" size={14} className="mt-0.5" />
        </button>
        {open && (
          <div className="bg-white border border-card-border px-2 py-1 w-full absolute top-[120%] left-0 flex flex-col rounded-2xl z-10">
            {options.map((option: string) => (
              <button
                className="outline-none border-0 bg-white hover:bg-card-hover! rounded-2xl! transition-all duration-300 p-2"
                key={option}
                onClick={() => handleSelect(option)}
              >
                <span className="text-body-4 text-text-primary">{option}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CardHeader;
