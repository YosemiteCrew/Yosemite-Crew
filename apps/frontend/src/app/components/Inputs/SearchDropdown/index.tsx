import React, { useEffect, useMemo, useRef, useState } from "react";
import { IoIosSearch, IoIosWarning } from "react-icons/io";

type OptionProps = {
  key: string;
  value: string;
};

type SearchDropdownProps = {
  options: OptionProps[];
  onSelect: (e: any) => void;
  placeholder: string;
  query: string;
  setQuery: (v: string) => void;
  minChars?: number;
  error?: string;
};

const SearchDropdown = ({
  onSelect,
  options,
  placeholder,
  query,
  setQuery,
  minChars = 2,
  error
}: SearchDropdownProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [hasSelected, setHasSelected] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((s: OptionProps) => {
      const name = s.value.toLowerCase();
      if (!q) return true;
      return name.includes(q);
    });
  }, [query, options]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const onSelectOption = (key: string) => {
    onSelect(key);
    setHasSelected(true);
    setOpen(false);
  };

  const canSearch = open && query.length >= minChars && filtered.length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className={`h-12 border px-4 py-2.5 flex items-center justify-center w-full ${canSearch ? "border-input-border-active! rounded-t-2xl!" : "border-input-border-default! rounded-2xl!"}`}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="outline-none border-0 text-body-4 text-text-primary w-full placeholder:text-input-text-placeholder placeholder:text-body-4"
          placeholder={placeholder}
        />
        <IoIosSearch size={22} color="#302F2E" className="cursor-pointer" />
      </div>
      {canSearch && (
        <div className="border-input-border-active max-h-[200px] overflow-y-auto scrollbar-hidden z-99 absolute top-[100%] left-0 rounded-b-2xl border-l border-r border-b bg-white flex flex-col items-center w-full px-[12px] py-[10px]">
          {filtered.map((option, i) => (
            <button
              key={option.key}
              onClick={() => onSelectOption(option.key)}
              className={`px-[1.25rem] py-[0.75rem] text-body-4 hover:bg-card-hover rounded-2xl! text-text-secondary! hover:text-text-primary! w-full text-start`}
            >
              {option.value}
            </button>
          ))}
        </div>
      )}
      {!open && error && !hasSelected && (
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

export default SearchDropdown;
