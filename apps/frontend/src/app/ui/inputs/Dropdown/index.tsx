import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { IoChevronDown } from 'react-icons/io5';
import { IoIosWarning } from 'react-icons/io';
import { useListboxKeyboardNav } from './useDropdownKeyboardNav';

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

const Dropdown = ({ placeholder, options, defaultOption, onSelect, error }: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Option | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const [prevDefaultDeps, setPrevDefaultDeps] = useState<{
    defaultOption?: string;
    options: Option[];
  } | null>(null);
  if (
    prevDefaultDeps === null ||
    defaultOption !== prevDefaultDeps.defaultOption ||
    options !== prevDefaultDeps.options
  ) {
    setPrevDefaultDeps({ defaultOption, options });
    if (defaultOption) {
      const found = options.find((option) => option.key === defaultOption);
      if (found) setSelected(found);
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectOption = (option: Option) => {
    setSelected(option);
    onSelect(option);
    setOpen(false);
  };

  const openDropdown = useCallback(() => setOpen(true), []);
  const closeDropdown = useCallback(() => setOpen(false), []);

  const { activeOptionId, setActiveIndex, handleKeyDown } = useListboxKeyboardNav({
    open,
    openDropdown,
    closeDropdown,
    options,
    listboxId,
    selectionKey: selected?.key,
    getOptionValue: (option) => option.key,
    isOptionSelected: (option) => option.key === selected?.key,
    selectOption,
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className={`w-full flex items-center justify-between gap-2 h-[44px] px-[13px] min-w-[120px] rounded-[12px]! bg-[var(--field-bg)] border-[1.5px] text-[13px] outline-none transition-colors focus:shadow-[0_0_0_3px_var(--glow-b10)] ${
          error ? 'border-[var(--danger)]!' : 'border-[var(--hairline)]!'
        } ${open ? 'border-[var(--blue)]! shadow-[0_0_0_3px_var(--glow-b10)]' : ''}`}
        onClick={() => setOpen((e) => !e)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
      >
        {selected ? (
          <div className="text-[var(--ink-body)] text-[13px] truncate max-w-[200px]">
            {selected.label}
          </div>
        ) : (
          <div className="text-[var(--ink-faint)] text-[13px] truncate max-w-[200px]">
            {placeholder}
          </div>
        )}
        <IoChevronDown
          size={13}
          color="var(--ink-faint)"
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          id={listboxId}
          className="max-h-[200px] overflow-y-auto scrollbar-hidden z-200 absolute top-[calc(100%_+_4px)] left-0 rounded-[13px] border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_24px_60px_var(--sh28)] flex flex-col items-stretch gap-px w-full p-1.5"
        >
          {options.map((option, i) => (
            <button
              type="button"
              key={option.key + i}
              id={`${listboxId}-option-${option.key}`}
              className={`px-[11px] py-[7px] text-[12.5px] font-semibold rounded-[8px]! w-full text-left transition-colors hover:bg-[var(--nav-active-bg)] hover:text-[var(--nav-active)]! ${
                activeOptionId === `${listboxId}-option-${option.key}`
                  ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active)]!'
                  : 'text-[var(--ink-body)]!'
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => selectOption(option)}
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
