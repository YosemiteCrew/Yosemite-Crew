import React, { useEffect, useMemo, useRef, useState } from "react";
import { IoSearch } from "react-icons/io5";

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
  minChars?: number
};

const SearchDropdown = ({
  onSelect,
  options,
  placeholder,
  query,
  setQuery,
  minChars = 2
}: SearchDropdownProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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
    setOpen(false);
  };

  const canSearch = open && query.length >= minChars && filtered.length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className={`h-12 rounded-2xl border! border-[#BFBFBE]! px-4 py-2.5 flex items-center justify-center w-full`}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="outline-none border-0 text-[18px]! w-full"
          placeholder={placeholder}
        />
        <IoSearch size={22} color="#302F2E" className="cursor-pointer" />
      </div>
      {canSearch && (
        <div className="absolute left-0 mt-1 border border-grey-noti bg-white z-10 rounded-xl max-h-[150px] w-full overflow-auto flex flex-col py-1 px-2 scrollbar-hidden">
          {filtered.map((option, i) => (
            <button
              key={option.key}
              onClick={() => onSelectOption(option.key)}
              className={`${i != filtered.length - 1 && "border-b border-grey-light"} py-2 px-2 outline-none bg-white text-[13px] font-satoshi font-semibold text-black-text text-start`}
            >
              {option.value}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchDropdown;
