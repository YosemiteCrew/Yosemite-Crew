'use client';
import React from 'react';
import { IoCaretDown } from 'react-icons/io5';
import { useDropdown, useFilteredOptions, DropdownOption } from '@/app/hooks/useDropdown';

import './DynamicSelect.css';

export type Option = DropdownOption;

interface DynamicSelectProps {
  options: Option[];
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  inname: string;
  error?: string;
  searchable?: boolean;
}

const DynamicSelect: React.FC<DynamicSelectProps> = ({
  options,
  placeholder = 'Select an option',
  value,
  onChange,
  inname: _inname,
  error,
  searchable = true,
}) => {
  const {
    open,
    searchQuery,
    setSearchQuery,
    dropdownRef,
    inputRef,
    openDropdown,
    toggleDropdown,
    closeDropdown,
  } = useDropdown({ searchable });

  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder;

  const filteredOptions = useFilteredOptions(options, searchQuery);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    closeDropdown();
  };

  const toggleClassName = `custom-dropdown-toggle ${open ? 'open' : ''}`;
  const caret = (
    <IoCaretDown
      className={`dropdown-caret ${open ? 'rotate' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        toggleDropdown();
      }}
    />
  );

  return (
    <div className="SelectedInptDropdown" ref={dropdownRef}>
      {/*
        Two shapes for the same bar. While the inline search is showing, the bar is a
        plain <div>: an <input> nested inside a <button> is invalid HTML - the parser
        splits them apart and the input loses its own semantics. The toggle is only a
        <button> when it actually acts as one, which is exactly when the search input
        is not rendered (its onClick already no-ops once the menu is open).
      */}
      {open && searchable ? (
        <div className={toggleClassName}>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={selectedLabel}
            aria-label={`Search ${placeholder}`}
            className="dropdown-inline-search"
          />
          {caret}
        </div>
      ) : (
        <button
          type="button"
          className={toggleClassName}
          onClick={() => {
            if (!open) openDropdown();
          }}
        >
          <span>{selectedLabel}</span>
          {caret}
        </button>
      )}

      {open && (
        <div className="custom-dropdown-menu show">
          {!searchQuery && (
            <button type="button" className="dropdown-item" onClick={() => handleSelect('')}>
              {placeholder}
            </button>
          )}

          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                className={`dropdown-item ${option.value === value ? 'selected' : ''}`}
                onClick={() => handleSelect(option.value)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="dropdown-item disabled">
              {searchQuery ? 'No matches found' : 'No options available'}
            </div>
          )}
        </div>
      )}

      {error && <span className="text-xs text-[var(--danger-text)] mt-1">{error}</span>}
    </div>
  );
};

export default DynamicSelect;
