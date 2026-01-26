import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaCaretDown } from "react-icons/fa6";
import { IoIosWarning } from "react-icons/io";

type Option = {
  value: string;
  label: string;
};

type DropdownProps = {
  placeholder: string;
  options: Option[];
  defaultOption?: string;
  onSelect: (option: Option) => void;
  error?: string;
  searchable?: boolean;
};

const LabelDropdown = ({
  placeholder,
  options,
  defaultOption,
  onSelect,
  error,
  searchable = true,
}: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Option | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!defaultOption) {
      setSelected(null);
      return;
    }
    const found = options.find((option) => option.value === defaultOption);
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
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (open && searchable && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open, searchable]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  return (
    <div className="w-full relative" ref={dropdownRef}>
      <button
        type="button"
        className={`w-full flex items-center justify-between gap-2 px-6 py-[11px] min-w-[120px] border cursor-pointer ${open ? "border-input-text-placeholder-active! rounded-t-2xl!" : "border-input-border-default! rounded-2xl!"} ${!selected && error && "border-input-border-error!"}`}
        onClick={() => {
          if (!open) {
            setOpen(true);
          }
        }}
      >
        {open && searchable ? (
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={selected ? selected.label : placeholder}
            className="w-full bg-transparent text-body-4 text-black-text outline-none placeholder:text-input-text-placeholder"
          />
        ) : selected ? (
          <div className="text-black-text text-body-4 max-w-[200px] truncate">
            {selected.label}
          </div>
        ) : (
          <div className="text-input-text-placeholder text-body-4 max-w-[200px] truncate">
            {placeholder}
          </div>
        )}
        <FaCaretDown
          size={20}
          className={`text-black-text transition-transform cursor-pointer shrink-0 ${open ? "rotate-180" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
            if (open) setSearchQuery("");
          }}
        />
      </button>
      {selected && !open && (
        <div
          className={`pointer-events-none absolute left-6
          -top-[11px] translate-y-0
          text-sm! text-input-text-placeholder
          bg-(--whitebg) px-1`}
        >
          {placeholder}
        </div>
      )}
      {open && (
        <div className="border-input-text-placeholder-active max-h-[200px] overflow-y-auto scrollbar-hidden z-99 absolute top-[100%] left-0 rounded-b-2xl border-l border-r border-b bg-white flex flex-col items-center w-full px-[12px] py-[10px]">
          {filteredOptions.length > 0 &&
            filteredOptions.map((option, i) => (
              <button
                key={option.value + i}
                className="px-[1.25rem] py-[0.75rem] text-left text-body-4 hover:bg-card-hover rounded-2xl! text-text-secondary! hover:text-text-primary! w-full"
                onClick={() => {
                  setSelected(option);
                  onSelect(option);
                  setOpen(false);
                  setSearchQuery("");
                }}
              >
                {option.label}
              </button>
            ))}
          {filteredOptions.length === 0 && (
            <div className="text-caption-1 py-3 text-text-primary text-center">
              {searchQuery ? "No matches found" : "No options"}
            </div>
          )}
        </div>
      )}
      {!open && !selected && error && (
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

export default LabelDropdown;
