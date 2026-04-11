import React, { useEffect, useMemo, useRef, useState } from "react";
import { IoSearch } from "react-icons/io5";
import { specialties as SPECIALITIES } from "@/app/lib/specialities";
import { useOrgStore } from "@/app/stores/orgStore";

import "./SpecialitySearch.css";

type SpecialitySearchBaseProps<T extends { name: string }> = {
  specialities: T[];
  setSpecialities: React.Dispatch<React.SetStateAction<T[]>>;
  multiple?: boolean;
  currentSpecialities?: T[];
};

const SpecialitySearchBase = <T extends { name: string }>({
  specialities,
  setSpecialities,
  multiple = true,
  currentSpecialities = [],
}: SpecialitySearchBaseProps<T>) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  const currentNames = useMemo(
    () => new Set(currentSpecialities.map((s) => s.name.toLowerCase())),
    [currentSpecialities],
  );

  const selectedNames = useMemo(
    () => new Set(specialities.map((s) => s.name.toLowerCase())),
    [specialities],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SPECIALITIES.filter((s: any) => {
      const name = s.name.toLowerCase();
      if (selectedNames.has(name)) return false;
      if (currentNames.has(name)) return false;
      if (!q) return true;
      return name.includes(q);
    });
  }, [query, selectedNames, currentNames]);

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

  const handleSelectSpeciality = (speciality: { name: string }) => {
    if (!primaryOrgId) return;
    const newItem = ({
      name: speciality.name,
      organisationId: primaryOrgId,
    } as unknown) as T;
    setSpecialities((prev: T[]) => {
      if (!multiple) {
        return [newItem];
      }
      const exists = prev.some(
        (s) => s.name.toLowerCase() === speciality.name.toLowerCase(),
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
    if (!primaryOrgId) return;
    const newItem = ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      organisationId: primaryOrgId,
    } as unknown) as T;
    setSpecialities((prev) => {
      if (!multiple) {
        return [newItem];
      }
      const exists = prev.some(
        (s) => s.name.toLowerCase() === name.toLowerCase(),
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

export default SpecialitySearchBase;
