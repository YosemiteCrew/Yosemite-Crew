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

const LabelDropdown = ({
  placeholder,
  options,
  defaultOption,
  onSelect,
  error
}: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Option | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
        buttonRef.current?.blur();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="w-full relative" ref={dropdownRef}>
      <button
        className={`w-full peer flex items-center justify-between gap-2 px-6 py-[11px] min-w-[120px] border border-input-border-default! focus:border-input-text-placeholder-active! ${!selected && error && "border-input-border-error!"} ${open ? "rounded-t-2xl!" : "rounded-2xl!"}`}
        onClick={() => {
          setOpen((e) => !e);
          requestAnimationFrame(() => buttonRef.current?.focus());
        }}
        ref={buttonRef}
      >
        {selected ? (
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
          className={`text-black-text transition-transform cursor-pointer`}
        />
      </button>
      {selected && (
        <div
          className={`pointer-events-none absolute left-6
          top-1/2 -translate-y-1/2
          text-body-4 text-input-text-placeholder
          transition-all duration-200
          peer-focus:-top-[11px] peer-focus:translate-y-0
          peer-focus:text-sm!
          peer-focus:text-input-text-placeholder-active
          peer-focus:bg-(--whitebg)
            peer-focus:px-1 peer-not-placeholder-shown:px-1
            peer-not-placeholder-shown:-top-[11px] peer-not-placeholder-shown:translate-y-0
            peer-not-placeholder-shown:text-sm!
            peer-not-placeholder-shown:bg-(--whitebg)`}
        >
          {placeholder}
        </div>
      )}
      {open && (
        <div className="border-input-text-placeholder-active max-h-[200px] overflow-y-auto scrollbar-hidden z-99 absolute top-[100%] left-0 rounded-b-2xl border-l border-r border-b bg-white flex flex-col items-center w-full px-[12px] py-[10px]">
          {options.length > 0 && options.map((option, i) => (
            <button
              key={option.key + i}
              className="px-[1.25rem] py-[0.75rem] text-left text-body-4 hover:bg-card-hover rounded-2xl! text-text-secondary! hover:text-text-primary! w-full"
              onClick={() => {
                setSelected(option);
                onSelect(option);
                setOpen(false);
                buttonRef.current?.blur();
              }}
            >
              {option.label}
            </button>
          ))}
          {options.length === 0 && (
            <div className="text-caption-1 py-1 text-text-primary">No options</div>
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
