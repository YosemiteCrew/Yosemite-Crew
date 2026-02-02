"use client";
import React from "react";
import { Form } from "react-bootstrap";
import { FaCaretDown } from "react-icons/fa6";
import { useDropdown, useFilteredOptions, DropdownOption } from "@/app/hooks/useDropdown";

import "./DynamicSelect.css";

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
  placeholder = "Select an option",
  value,
  onChange,
  inname,
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

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || placeholder;

  const filteredOptions = useFilteredOptions(options, searchQuery);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    closeDropdown();
  };

  return (
    <div className="SelectedInptDropdown" ref={dropdownRef}>
      <button
        type="button"
        className={`custom-dropdown-toggle ${open ? "open" : ""}`}
        onClick={() => {
          if (!open) openDropdown();
        }}
      >
        {open && searchable ? (
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={selectedLabel}
            className="dropdown-inline-search"
          />
        ) : (
          <span>{selectedLabel}</span>
        )}
        <FaCaretDown
          className={`dropdown-caret ${open ? "rotate" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleDropdown();
          }}
        />
      </button>

      {open && (
        <div className="custom-dropdown-menu show">
          {!searchQuery && (
            <button
              type="button"
              className="dropdown-item"
              onClick={() => handleSelect("")}
            >
              {placeholder}
            </button>
          )}

          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                className={`dropdown-item ${option.value === value ? "selected" : ""}`}
                onClick={() => handleSelect(option.value)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="dropdown-item disabled">
              {searchQuery ? "No matches found" : "No options available"}
            </div>
          )}
        </div>
      )}

      {error && <Form.Text className="text-danger">{error}</Form.Text>}
    </div>
  );
};

export default DynamicSelect;
