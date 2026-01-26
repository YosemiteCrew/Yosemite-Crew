import React, { useEffect, useMemo, useRef, useState } from "react";
import { IoIosClose, IoIosWarning } from "react-icons/io";
import { Option } from "@/app/types/companion";
import { FaCaretDown } from "react-icons/fa6";

type DropdownProps = {
  placeholder: string;
  value: string[];
  onChange: (e: string[]) => void;
  error?: string;
  options?: Array<string | { label: string; value: string }>;
  searchable?: boolean;
};

const MultiSelectDropdown = ({
  placeholder,
  onChange,
  value,
  error,
  options,
  searchable = true,
}: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const list: Option[] = useMemo(() => {
    return (
      options?.map((opt) =>
        typeof opt === "string" ? { label: opt, value: opt } : opt
      ) ?? []
    );
  }, [options]);

  const valueSet = useMemo(() => new Set(value), [value]);

  const selectedOptions = useMemo(
    () => list.filter((opt) => valueSet.has(opt.value)),
    [list, valueSet]
  );

  const availableOptions = useMemo(
    () => list.filter((opt) => !valueSet.has(opt.value)),
    [list, valueSet]
  );

  const filteredAvailableOptions = useMemo(() => {
    if (!searchQuery.trim()) return availableOptions;
    const query = searchQuery.toLowerCase();
    return availableOptions.filter((option) =>
      option.label.toLowerCase().includes(query)
    );
  }, [availableOptions, searchQuery]);

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

  const toggleOption = (option: Option) => {
    const isSelected = valueSet.has(option.value);
    const next = isSelected
      ? value.filter((v) => v !== option.value)
      : [...value, option.value];

    onChange(next);
    setSearchQuery("");
    setOpen(false);
  };

  const removeOption = (val: string) => {
    onChange(value.filter((v) => v !== val));
  };

  return (
    <div className="flex flex-col">
      <div className="relative w-full" ref={dropdownRef}>
        <button
          type="button"
          className={`w-full flex items-center justify-between gap-2 px-6 py-[11px] min-w-[120px] border cursor-pointer ${open ? "border-input-text-placeholder-active! rounded-t-2xl!" : "border-input-border-default! rounded-2xl!"} ${selectedOptions.length === 0 && error && "border-input-border-error!"}`}
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
              placeholder={placeholder}
              className="w-full bg-transparent text-body-4 text-black-text outline-none placeholder:text-input-text-placeholder"
            />
          ) : (
            <div className="text-input-text-placeholder text-body-4">
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
        {open && (
          <div className="border-input-text-placeholder-active max-h-[200px] overflow-y-auto scrollbar-hidden z-200 absolute top-full left-0 rounded-b-2xl border-l border-r border-b bg-white flex flex-col items-stretch w-full px-3 py-2.5">
            {filteredAvailableOptions.length > 0 ? (
              filteredAvailableOptions.map((option, index: number) => (
                <button
                  className="px-3 py-2 text-left text-body-4 hover:bg-card-hover rounded-lg text-text-secondary hover:text-text-primary w-full"
                  key={option.value + index}
                  onClick={() => toggleOption(option)}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="text-caption-1 py-3 text-text-primary text-center">
                {searchQuery ? "No matches found" : "No options available"}
              </div>
            )}
          </div>
        )}
        {!open && !selectedOptions && error && (
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
      {selectedOptions && selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedOptions.map((item) => (
            <div
              key={item.value}
              className="px-3! py-1.5! rounded-2xl border border-grey-light flex gap-1 items-center"
            >
              <span className="text-caption-1 text-text-primary">
                {item.label}
              </span>
              <IoIosClose
                color="#302f2e"
                className="pt-0.5! cursor-pointer"
                size={24}
                onClick={() => removeOption(item.value)}
              />
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="mt-1.5 flex items-center gap-1 px-4 text-caption-2 text-text-error">
          <IoIosWarning className="text-text-error" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
