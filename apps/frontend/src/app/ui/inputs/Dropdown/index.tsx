import React, { useEffect, useRef, useState } from "react";
import { FaCaretDown } from "react-icons/fa6";
import { IoIosWarning } from "react-icons/io";

type Option = {
  key: string;
  label: string;
};

type DropdownProps = {
  placeholder: string;
  options: Option[];
  defaultOption?: string;
  onSelect: (option: Option) => void;
  error?: string;
};

const Dropdown = ({
  placeholder,
  options,
  defaultOption,
  onSelect,
  error,
}: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Option | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!defaultOption) return;
    const found = options.find((option) => option.key === defaultOption);
    if (found) {
      setSelected(found);
    }
  }, [defaultOption, options]);

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
    <div className="relative" ref={dropdownRef}>
      <button
        className={`w-full flex items-center justify-between gap-2 px-6 py-[10px] min-w-[120px] ${error && "border-input-border-error!"} ${open ? "border border-input-border-active! rounded-t-2xl!" : "border border-input-border-default! rounded-2xl!"}`}
        onClick={() => setOpen((e) => !e)}
      >
        {selected ? (
          <div className="text-black-text text-body-4 truncate max-w-[200px]">
            {selected.label}
          </div>
        ) : (
          <div className="text-black-text text-body-4 truncate max-w-[200px]">
            {placeholder}
          </div>
        )}
        <FaCaretDown
          size={20}
          className={`text-black-text transition-transform cursor-pointer`}
        />
      </button>
      {open && (
        <div className="border-input-border-active max-h-[200px] overflow-y-auto scrollbar-hidden z-99 absolute top-[100%] left-0 rounded-b-2xl border-l border-r border-b bg-white flex flex-col items-center w-full px-[12px] py-[10px]">
          {options.map((option, i) => (
            <button
              key={option.key + i}
              className="px-[1.25rem] py-[0.75rem] text-body-4 hover:bg-card-hover rounded-2xl! text-text-secondary! hover:text-text-primary! w-full"
              onClick={() => {
                setSelected(option);
                onSelect(option);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div
          className={`
            mt-1.5 flex items-center gap-1 px-4
            text-caption-2 text-text-error
            `}
        >
          <IoIosWarning className="text-text-error" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default Dropdown;
