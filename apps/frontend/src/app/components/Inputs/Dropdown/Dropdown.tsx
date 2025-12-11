import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaSortDown } from "react-icons/fa";
import { IoSearch } from "react-icons/io5";
import classNames from "classnames";
import { Icon } from "@iconify/react/dist/iconify.js";

import countries from "@/app/utils/countryList.json";

import "./Dropdown.css";

type DropdownType = "country" | "breed" | "general" | undefined;

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
}: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const list = useMemo(() => {
    if (type === "country") {
      return countries.map((option) => ({
        key: option.code,
        label: `${option.flag} ${option.name}`,
        value: option.name,
      }));
    }
    if (type === "breed") {
      return (options ?? []).map((option: any, index: number) => ({
        key: option.breedId ?? index,
        label: option.breedName ?? "",
        value: option.breedName ?? "",
      }));
    }
    return (options ?? []).map((option: any, index: number) => {
      if (typeof option === "string") {
        return { key: option, label: option, value: option };
      }
      if (option && typeof option === "object" && "label" in option) {
        const val = option.value ?? option.label ?? index.toString();
        return {
          key: val ?? index,
          label: option.label ?? String(val),
          value: val ?? "",
        };
      }
      const str = String(option ?? index);
      return { key: index, label: str, value: str };
    });
  }, [options, type]);
  const [query, setQuery] = useState("");

  const filteredList = useMemo(() => {
    if (search) {
      return list.filter((item: any) => {
        const matchesSearch = (item.label || "")
          .toLowerCase()
          .includes(query.toLowerCase());
        return matchesSearch;
      });
    }
    return list;
  }, [list, query]);

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

  const isActive = open || !!value;
  const selected = list.find((opt: any) => opt.value === value);

  return (
    <div className="select-wrapper">
      <div
        className={classNames("select-container floating-input", {
          focused: isActive,
        })}
        ref={dropdownRef}
      >
        <button
          className={classNames(
            "select-input-container",
            { blueborder: value, "pointer-events-none opacity-70": disabled },
            className
          )}
          onClick={() => {
            if (disabled) return;
            setOpen((prev) => !prev);
          }}
        >
          {selected && (
            <div className="select-input-selected">{selected.label}</div>
          )}
          <div className="select-input-drop-icon">
            <FaSortDown color="#747473" size={20} />
          </div>
        </button>
        <label className="select-floating-label">{placeholder}</label>
        {open && !disabled && (
          <div className={`select-input-dropdown ${dropdownClassName}`}>
            {search && (
              <div
                className={`h-12! rounded-2xl border! border-[#BFBFBE]! px-4! py-2! flex items-center justify-center`}
              >
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="outline-none border-0 text-[16px]! w-full px-2"
                  placeholder="Search"
                />
                <IoSearch
                  size={22}
                  color="#BFBFBE"
                  className="cursor-pointer"
                />
              </div>
            )}
            {filteredList.length > 0 &&
              filteredList.map((option: any, index: number) => {
                const key: React.Key = option.key ?? index;
                const label: string = option.label ?? option.value ?? "";
                const valueToSend: string = option.value ?? option.label ?? "";
                const handleClick = () => {
                  onChange(valueToSend);
                  setOpen(false);
                  setQuery("");
                };
                return (
                  <button
                    className={`select-input-dropdown-item ${index === list.length - 1 ? "" : "border-b border-grey-light"}`}
                    key={key}
                    onClick={handleClick}
                  >
                    {label}
                  </button>
                );
              })}
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

export default Dropdown;
