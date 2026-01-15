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
};

const MultiSelectDropdown = ({
  placeholder,
  onChange,
  value,
  error,
  options,
}: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        buttonRef.current?.blur();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleOption = (option: Option) => {
    const isSelected = valueSet.has(option.value);
    const next = isSelected
      ? value.filter((v) => v !== option.value)
      : [...value, option.value];

    onChange(next);
    setOpen(false);
    buttonRef.current?.blur();
  };

  const removeOption = (val: string) => {
    onChange(value.filter((v) => v !== val));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-full" ref={dropdownRef}>
        <button
          className={`w-full peer flex items-center justify-between gap-2 px-6 py-[11px] min-w-[120px] border border-input-border-default! focus:border-input-text-placeholder-active! ${selectedOptions.length === 0 && error && "border-input-border-error!"} ${open ? "rounded-t-2xl!" : "rounded-2xl!"}`}
          onClick={() => {
            setOpen((e) => !e);
            requestAnimationFrame(() => buttonRef.current?.focus());
          }}
          ref={buttonRef}
        >
          <div className="text-input-text-placeholder text-body-4">
            {placeholder}
          </div>
          <FaCaretDown
            size={20}
            className={`text-black-text transition-transform cursor-pointer`}
          />
        </button>
        {open && availableOptions.length > 0 && (
          <div className="border-input-text-placeholder-active max-h-[200px] overflow-y-auto scrollbar-hidden z-99 absolute top-[100%] left-0 rounded-b-2xl border-l border-r border-b bg-white flex flex-col items-center w-full px-[12px] py-[10px]">
            {availableOptions.map((option, index: number) => (
              <button
                className="px-[1.25rem] py-[0.75rem] text-left text-body-4 hover:bg-card-hover rounded-2xl! text-text-secondary! hover:text-text-primary! w-full"
                key={option.value + index}
                onClick={() => toggleOption(option)}
              >
                {option.label}
              </button>
            ))}
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
        <div className="flex flex-wrap gap-2">
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
    </div>
  );
};

export default MultiSelectDropdown;
