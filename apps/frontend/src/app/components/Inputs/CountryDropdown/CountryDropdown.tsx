import React, { useEffect, useRef, useState } from "react";
import { FaSortDown } from "react-icons/fa";
import { Icon } from "@iconify/react/dist/iconify.js";
import countries from "../../../utils/countryList.json";
import classNames from "classnames";

import "./CountryDropdown.css";

type CountryDropdownProps = {
  placeholder: string;
  value: string;
  onChange: (e: string) => void;
  error?: string;
};

const CountryDropdown = ({
  placeholder,
  onChange,
  value,
  error,
}: CountryDropdownProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="select-wrapper">
      <div className="select-container" ref={dropdownRef}>
        <button
          className={classNames("select-input-container", { blueborder: value })}
          onClick={() => setOpen((prev) => !prev)}
        >
          {value ? (
            <div className="select-input-selected">{value}</div>
          ) : (
            <div className="select-input-placeholder">{placeholder}</div>
          )}
          <div className="select-input-drop-icon">
            <FaSortDown color="#747473" size={24} />
          </div>
        </button>
        {open && (
          <div className="select-input-dropdown">
            {countries.map((country) => (
              <button
                className="select-input-dropdown-item"
                key={country.code}
                onClick={() => {
                  onChange(country.flag + " " + country.name);
                  setOpen(false);
                }}
              >
                {country.flag} {country.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="Errors">
          <Icon icon="mdi:error" width="16" height="16" />
          {error}
        </div>
      )}
    </div>
  );
};

export default CountryDropdown;
