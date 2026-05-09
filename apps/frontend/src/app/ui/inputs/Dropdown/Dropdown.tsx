import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { FaSortDown } from 'react-icons/fa';
import { IoSearch } from 'react-icons/io5';
import classNames from 'classnames';
import { Icon } from '@iconify/react/dist/iconify.js';

import countries from '@/app/lib/data/countryList';

import './Dropdown.css';

type DropdownType = 'country' | 'breed' | 'general' | undefined;

type DropdownProps = {
  placeholder: string;
  value: string;
  onChange: (e: any) => void;
  error?: string;
  className?: string;
  dropdownClassName?: string;
  options?: Array<string | { label: string; value: string }>;
  type?: DropdownType;
  search?: boolean;
  disabled?: boolean;
  returnObject?: boolean;
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
  search = false,
  disabled = false,
  returnObject = false,
}: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const errorId = useId();
  const searchInputId = useId();

  const list = useMemo(() => {
    if (type === 'country') {
      return countries.map((option) => ({
        key: option.code,
        label: `${option.flag} ${option.name}`,
        value: option.name,
      }));
    }
    if (type === 'breed') {
      return (options ?? []).map((option: any, index: number) => ({
        key: option.breedId ?? index,
        label: option.breedName ?? '',
        value: option.breedName ?? '',
      }));
    }
    return (options ?? []).map((option: any, index: number) => {
      if (typeof option === 'string') {
        return { key: option, label: option, value: option };
      }
      if (option && typeof option === 'object' && 'label' in option) {
        const val = option.value ?? option.label ?? index.toString();
        return {
          key: val ?? index,
          label: option.label ?? String(val),
          value: val ?? '',
        };
      }
      const str = String(option ?? index);
      return { key: index, label: str, value: str };
    });
  }, [options, type]);

  const [query, setQuery] = useState('');

  const filteredList = useMemo(() => {
    if (search) {
      return list.filter((item: any) =>
        (item.label || '').toLowerCase().includes(query.toLowerCase())
      );
    }
    return list;
  }, [list, query, search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const isActive = open || !!value;
  const selected = list.find((opt: any) => opt.value === value);

  return (
    <div className="select-wrapper">
      <div
        className={classNames('select-container floating-input', { focused: isActive })}
        ref={dropdownRef}
      >
        <button
          type="button"
          className={classNames(
            'select-input-container',
            { blueborder: value, 'pointer-events-none opacity-70': disabled },
            className
          )}
          onClick={() => {
            if (disabled) return;
            setOpen((prev) => !prev);
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label={selected ? `${placeholder}: ${selected.label}` : placeholder}
          aria-describedby={error ? errorId : undefined}
          disabled={disabled}
        >
          {selected && <div className="select-input-selected">{selected.label}</div>}
          <div className="select-input-drop-icon" aria-hidden="true">
            <FaSortDown color="var(--color-neutral-600)" size={20} />
          </div>
        </button>
        <label className="select-floating-label" aria-hidden="true">
          {placeholder}
        </label>

        {open && !disabled && (
          <div
            id={listboxId}
            aria-label={placeholder}
            className={`select-input-dropdown ${dropdownClassName ?? ''}`}
          >
            {search && (
              <div className="h-12! rounded-2xl border! border-input-border-default! px-4! py-2! flex items-center justify-center">
                <label htmlFor={searchInputId} className="sr-only">
                  Search {placeholder}
                </label>
                <input
                  id={searchInputId}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="border-0 text-[16px]! w-full px-2 focus-visible:outline-none"
                  placeholder={`Search ${placeholder}`}
                  autoComplete="off"
                />
                <IoSearch
                  size={22}
                  color="var(--color-neutral-200)"
                  className="cursor-pointer"
                  aria-hidden="true"
                />
              </div>
            )}
            {filteredList.map((option: any, index: number) => {
              const label: string = option.label ?? option.value ?? '';
              const valueToSend: string = option.value ?? option.label ?? '';
              const isSelected = valueToSend === value;
              return (
                <button
                  key={label + 'team-key' + index}
                  aria-pressed={isSelected}
                  className={`select-input-dropdown-item ${index === list.length - 1 ? '' : 'border-b border-grey-light'}`}
                  onClick={() => {
                    onChange(returnObject ? option : valueToSend);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div id={errorId} role="alert" className="Errors">
          <Icon icon="mdi:error" width="16" height="16" aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
