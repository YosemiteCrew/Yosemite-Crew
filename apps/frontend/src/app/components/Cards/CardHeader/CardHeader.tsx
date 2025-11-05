"use client";
import React, { useEffect, useRef, useState } from "react";
import { FaAngleDown } from "react-icons/fa";

import "./CardHeader.css";

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
    <div className="card-header-container">
      <div className="card-header-title">{title}</div>
      <div className="card-header-filters" ref={filterRef}>
        <button
          onClick={() => setOpen((e) => !e)}
          className="card-header-selected"
        >
          {selected}
          <FaAngleDown color="#302F2E" size={14} />
        </button>
        {open && (
          <div className="card-header-dropdown">
            {options.map((option: string) => (
              <button
                className="card-header-dropdown-item"
                key={option}
                onClick={() => handleSelect(option)}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CardHeader;
