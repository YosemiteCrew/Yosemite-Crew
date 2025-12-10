import classNames from "classnames";
import React, { useEffect, useRef, useState } from "react";
import { FaSortDown } from "react-icons/fa";
import { IoIosClose } from "react-icons/io";

import "../Dropdown/Dropdown.css";

type DropdownProps = {
  placeholder: string;
  value: string[];
  onChange: (e: string[]) => void;
  error?: string;
  className?: string;
  dropdownClassName?: string;
  options?: Array<string | { label: string; value: string }>;
};

const MultiSelectDropdown = ({
  placeholder,
  onChange,
  value,
  error,
  className,
  dropdownClassName,
  options,
}: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const list =
    options?.map((opt) =>
      typeof opt === "string" ? { label: opt, value: opt } : opt
    ) ?? [];
  const availableOptions = list.filter(
    (option) => !value.includes(option.value)
  );

  const getLabel = (val: string) =>
    list.find((opt) => opt.value === val)?.label ?? val;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleOption = (option: string) => {
    const isSelected = value.includes(option);
    let newValue: string[];
    if (isSelected) {
      newValue = value.filter((item) => item !== option);
    } else {
      newValue = [...value, option];
    }
    onChange(newValue);
  };

  const removeOption = (option: string) => {
    const newValue = value.filter((item) => item !== option);
    onChange(newValue);
  };

  return (
    <div className="select-wrapper gap-2">
      <div className="select-container" ref={dropdownRef}>
        <button
          className={classNames(
            "select-input-container",
            { blueborder: value.length > 0 },
            className
          )}
          onClick={() => setOpen((prev) => !prev)}
        >
          <div className="select-input-placeholder">{placeholder}</div>
          <div className="select-input-drop-icon">
            <FaSortDown color="#747473" size={20} />
          </div>
        </button>
        {open && availableOptions.length > 0 && (
          <div className={`select-input-dropdown ${dropdownClassName}`}>
            {availableOptions.map((option, index: number) => (
              <button
                className={`select-input-dropdown-item ${index === list.length - 1 ? "" : "border-b border-grey-light"}`}
                key={option.value}
                onClick={() => toggleOption(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {value && value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((item) => (
            <div
              key={item}
              className="px-4! py-2! rounded-2xl border border-grey-light flex gap-1 items-center"
            >
              <span className="font-satoshi font-semibold text-[15px] text-black-text">
                {getLabel(item)}
              </span>
              <IoIosClose
                color="#302f2e"
                className="pt-0.5! cursor-pointer"
                size={28}
                onClick={() => removeOption(item)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
