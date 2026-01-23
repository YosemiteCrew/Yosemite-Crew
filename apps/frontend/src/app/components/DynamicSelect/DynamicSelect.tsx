"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Form } from "react-bootstrap";
import { FaCaretDown } from "react-icons/fa6";

import "./DynamicSelect.css";

export type Option = { value: string; label: string };

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
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || placeholder;

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

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

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setSearchQuery("");
    setOpen(false);
  };

  return (
    <div className="SelectedInptDropdown" ref={dropdownRef}>
      <div
        className={`custom-dropdown-toggle ${open ? "open" : ""}`}
        onClick={() => {
          if (!open) setOpen(true);
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
            setOpen((prev) => !prev);
            if (open) setSearchQuery("");
          }}
        />
      </div>

      {open && (
        <div className="custom-dropdown-menu show">
          {!searchQuery && (
            <div
              className="dropdown-item"
              onClick={() => handleSelect("")}
            >
              {placeholder}
            </div>
          )}

          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <div
                key={option.value}
                className="dropdown-item"
                onClick={() => handleSelect(option.value)}
              >
                {option.label}
              </div>
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
