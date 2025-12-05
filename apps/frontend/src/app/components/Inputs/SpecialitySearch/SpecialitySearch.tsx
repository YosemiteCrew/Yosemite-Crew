import React, { useEffect, useMemo, useRef, useState } from "react";
import { IoSearch } from "react-icons/io5";
import { specialties as SPECIALITIES } from "@/app/utils/specialities";
import { Speciality } from "@/app/types/org";

import "./SpecialitySearch.css";

type SpecialitySearchProps = {
  specialities: Speciality[];
  setSpecialities: React.Dispatch<React.SetStateAction<Speciality[]>>;
  multiple?: boolean;
};

const SpecialitySearch = ({
  specialities,
  setSpecialities,
  multiple = true,
}: SpecialitySearchProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedNames = useMemo(
    () => new Set(specialities.map((s: Speciality) => s.name.toLowerCase())),
    [specialities]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SPECIALITIES.filter((s: any) => {
      const name = s.name.toLowerCase();
      if (selectedNames.has(name)) return false;
      if (!q) return true;
      return name.includes(q);
    });
  }, [query, selectedNames]);

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

  const buildItemFromSpeciality = (speciality: any): Speciality => ({
    name: speciality.name,
    services: [],
    head: "",
    staff: [],
  });

  const handleSelectSpeciality = (speciality: Speciality) => {
    const newItem = buildItemFromSpeciality(speciality);
    setSpecialities((prev: Speciality[]) => {
      if (!multiple) {
        return [newItem];
      }
      const exists = prev.some(
        (s) => s.name.toLowerCase() === speciality.name.toLowerCase()
      );
      if (exists) return prev;
      return [...prev, newItem];
    });
    setQuery("");
    setOpen(false);
  };

  const handleAddSpeciality = () => {
    const name = query.trim();
    if (!name) return;
    const newItem: Speciality = {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      services: [],
      head: "",
      staff: [],
    };
    setSpecialities((prev) => {
      if (!multiple) {
        return [newItem];
      }
      const exists = prev.some(
        (s) => s.name.toLowerCase() === name.toLowerCase()
      );
      if (exists) return prev;
      return [newItem, ...prev];
    });
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="step-search" ref={wrapperRef}>
      <IoSearch size={20} className="step-search-icon" color="#302F2E" />
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
              <button
                key={speciality.name}
                className="step-search-speciality"
                onClick={() => handleSelectSpeciality(speciality)}
              >
                <div className="step-search-speciality-title">
                  {speciality.name}
                </div>
              </button>
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
