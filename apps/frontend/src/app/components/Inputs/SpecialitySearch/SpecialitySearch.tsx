import React, { useEffect, useMemo, useRef, useState } from "react";
import { IoSearch } from "react-icons/io5";

import "./SpecialitySearch.css";

const SpecialitySearch = ({ specialities, setSpecialities }: any) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return specialities;
    return specialities?.filter((s: any) => s.name.toLowerCase().includes(q));
  }, [query, specialities]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggle = (key: string, checked: boolean) => {
    setSpecialities((prev: any) =>
      prev.map((s: any) => (s.key === key ? { ...s, active: checked } : s))
    );
  };

  const handleAddSpeciality = () => {
    const name = query.trim();
    if (!name) return;
    const exists = specialities.some(
      (s: any) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) return;
    const newItem = {
      name,
      key: name,
      active: true,
      services: [],
    };
    setSpecialities((prev: any) => [newItem, ...prev]);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="step-search" ref={wrapperRef}>
      <IoSearch size={24} className="step-search-icon" color="#302F2E" />
      <input
        type="text"
        name="speciality-search"
        placeholder="Search or create specialty"
        className="step-search-input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="step-search-dropdown" id="speciality-search-listbox">
          {filtered?.length > 0 ? (
            filtered.map((speciality: any) => (
              <label
                key={speciality.key}
                className="step-search-speciality"
                aria-selected={speciality.active}
              >
                <input
                  type="checkbox"
                  className="step-search-speciality-check"
                  checked={speciality.active}
                  onChange={(e) =>
                    handleToggle(speciality.key, e.target.checked)
                  }
                />
                <div className="step-search-speciality-title">
                  {speciality.name}
                </div>
              </label>
            ))
          ) : (
            <button
              type="button"
              className="step-search-add"
              onClick={handleAddSpeciality}
            >
              Add speciality “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SpecialitySearch;
