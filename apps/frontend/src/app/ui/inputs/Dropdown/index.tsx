import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { IoChevronDown } from 'react-icons/io5';
import Field from '@/app/ui/Field';
import { getFieldControlClassName } from '@/app/ui/fieldControlStyles';
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
  const controlId = useId();
  const messageId = `${controlId}-message`;

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
    <Field error={error} htmlFor={controlId} messageId={messageId}>
      <div className="relative" ref={dropdownRef}>
        <button
          id={controlId}
          type="button"
          className={`${getFieldControlClassName(Boolean(error))} flex w-full min-w-[120px] items-center justify-between gap-2 ${
            open ? 'border-[var(--blue)]! shadow-[0_0_0_3px_var(--glow-b10)]' : ''
          }`}
          onClick={() => setOpen((isOpen) => !isOpen)}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-describedby={error ? messageId : undefined}
        >
          <span
            className={`max-w-[200px] truncate ${
              selected ? 'text-[var(--ink-body)]' : 'text-[var(--ink-faint)]'
            }`}
          >
            {selected?.label ?? placeholder}
          </span>
          <IoChevronDown
            size={13}
            color="var(--ink-muted)"
            className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {open && (
          <div
            id={listboxId}
            className="max-h-[200px] overflow-y-auto scrollbar-hidden z-200 absolute top-[calc(100%_+_4px)] left-0 rounded-[13px] border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_24px_60px_var(--sh28)] flex flex-col items-stretch gap-px w-full p-1.5"
          >
            {options.map((option, index) => (
              <button
                type="button"
                key={option.key + index}
                id={`${listboxId}-option-${option.key}`}
                className={`px-[11px] py-[7px] text-[12.5px] font-semibold rounded-[8px]! w-full text-left transition-colors hover:bg-[var(--nav-active-bg)] hover:text-[var(--nav-active)]! ${
                  activeOptionId === `${listboxId}-option-${option.key}`
                    ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active)]!'
                    : 'text-[var(--ink-body)]!'
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
};

export default Dropdown;
