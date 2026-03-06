import React, { useEffect, useRef, useState } from "react";

type DatepickerDropdownProps<T extends string | number> = {
  value: T;
  options: T[];
  onSelect: (value: T) => void;
  widthClassName: string;
  formatOption?: (option: T) => React.ReactNode;
};

const DatepickerDropdown = <T extends string | number>({
  value,
  options,
  onSelect,
  widthClassName,
  formatOption,
}: DatepickerDropdownProps<T>) => {
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

  const renderOption = (option: T) => (formatOption ? formatOption(option) : option);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((e) => !e)}
        className="text-[13px] font-satoshi font-semibold text-black-text border-none outline-none bg-white"
      >
        {renderOption(value)}
      </button>
      {open && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 mt-1 border border-grey-noti bg-white rounded-xl max-h-[200px] ${widthClassName} overflow-auto flex flex-col p-1 scrollbar-hidden`}
        >
          {options.map((option) => (
            <button
              className="py-1 outline-none bg-white text-[13px] font-satoshi font-semibold text-black-text"
              key={String(option)}
              onClick={() => {
                onSelect(option);
                setOpen(false);
              }}
            >
              {renderOption(option)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DatepickerDropdown;
