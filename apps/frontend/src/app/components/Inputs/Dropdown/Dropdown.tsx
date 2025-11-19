import React, { useEffect, useRef, useState } from "react";
import { FaSortDown } from "react-icons/fa";
import { Icon } from "@iconify/react/dist/iconify.js";
import classNames from "classnames";
import countries from "@/app/utils/countryList.json";

import "./Dropdown.css";

type DropdownType = "country" | "breed" | undefined;

type DropdownProps = {
  placeholder: string;
  value: string;
  onChange: (e: string) => void;
  error?: string;
  className?: string;
  dropdownClassName?: string;
  options?: any;
  type?: DropdownType;
};

const Dropdown = ({
  placeholder,
  onChange,
  value,
  error,
  className,
  dropdownClassName,
  options,
  type,
}: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const list = type === "country" ? countries : (options ?? []);

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

  return (
    <div className="select-wrapper">
      <div className="select-container" ref={dropdownRef}>
        <button
          className={classNames(
            "select-input-container",
            { blueborder: value },
            className
          )}
          onClick={() => setOpen((prev) => !prev)}
        >
          {value ? (
            <div className="select-input-selected">{value}</div>
          ) : (
            <div className="select-input-placeholder">{placeholder}</div>
          )}
          <div className="select-input-drop-icon">
            <FaSortDown color="#747473" size={20} />
          </div>
        </button>
        {open && list.length > 0 && (
          <div className={`select-input-dropdown ${dropdownClassName}`}>
            {list.map((option: any, index: number) => {
              let key: React.Key;
              let label: string;
              let valueToSend: string;
              if (type === "country") {
                key = option.code;
                label = `${option.flag} ${option.name}`;
                valueToSend = label;
              } else if (type === "breed") {
                key = option.breedId;
                label = option.breedName;
                valueToSend = option.breedName;
              } else {
                label = typeof option === "string" ? option : String(option);
                key = label || index;
                valueToSend = label;
              }
              const handleClick = () => {
                onChange(valueToSend);
                setOpen(false);
              };
              return (
                <button
                  className={`select-input-dropdown-item ${index === list.length - 1 ? "" : "border-b border-grey-light"}`}
                  key={key}
                  onClick={handleClick}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="Errors">
          <Icon icon="mdi:error" width="16" height="16" />
          {error}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
