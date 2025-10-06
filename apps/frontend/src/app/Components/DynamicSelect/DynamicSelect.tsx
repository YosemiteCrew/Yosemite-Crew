"use client";
import React from "react";
import { Dropdown, Form } from "react-bootstrap";

import "./DynamicSelect.css";

export type Option = { value: string; label: string };

interface DynamicSelectProps {
  options: Option[];
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  inname: string;
  error?: string;
}

const DynamicSelect: React.FC<DynamicSelectProps> = ({
  options,
  placeholder = "Select an option",
  value,
  onChange,
  inname,
  error,
}) => {
  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || placeholder;

  const handleSelect = (selectedKey: string | null) => {
    if (selectedKey !== null) {
      onChange(selectedKey);
    }
  };

  return (
    <div className="SelectedInptDropdown">
      <Dropdown onSelect={handleSelect}>
        <Dropdown.Toggle
          id={`${inname}-dropdown`}
          className="custom-dropdown-toggle"
        >
          {selectedLabel}
        </Dropdown.Toggle>

        <Dropdown.Menu className="custom-dropdown-menu">
          <Dropdown.Item eventKey="">{placeholder}</Dropdown.Item>

          {options.length > 0 ? (
            options.map((option, index) => (
              <Dropdown.Item key={option.value} eventKey={option.value}>
                {option.label}
              </Dropdown.Item>
            ))
          ) : (
            <Dropdown.Item disabled>No options available</Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown>

      {error && <Form.Text className="text-danger">{error}</Form.Text>}
    </div>
  );
};

export default DynamicSelect;
