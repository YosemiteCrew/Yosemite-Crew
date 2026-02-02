import React, { useEffect, useMemo, useRef, useState } from "react";
import { IoSearch } from "react-icons/io5";
import { specialtiesByKey } from "@/app/lib/specialities";
import { Service } from "@yosemite-crew/types";
import { SpecialityWeb } from "@/app/features/organization/types/speciality";

import "./ServiceSearch.css";

type ServiceSearchBaseProps = {
  speciality: SpecialityWeb;
  onSelectService: (serviceName: string) => void | Promise<void>;
  onAddService: (serviceName: string) => void | Promise<void>;
};

const ServiceSearchBase = ({
  speciality,
  onSelectService,
  onAddService,
}: ServiceSearchBaseProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const services = useMemo(
    () => specialtiesByKey[speciality.name]?.services || [],
    [speciality.name],
  );

  const selectedNames = useMemo(
    () =>
      new Set(
        (speciality.services || []).map((s: Service) => s.name.toLowerCase()),
      ),
    [speciality],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s: any) => {
      const name = s.toLowerCase();
      if (selectedNames.has(name)) return false;
      if (!q) return true;
      return name.includes(q);
    });
  }, [query, selectedNames, services]);

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

  const handleSelect = async (serviceName: string) => {
    await onSelectService(serviceName);
    setQuery("");
    setOpen(false);
  };

  const handleAdd = async () => {
    const name = query.trim();
    if (!name) return;
    await onAddService(name);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="service-search" ref={wrapperRef}>
      <IoSearch size={20} className="service-search-icon" color="#302F2E" />
      <input
        type="text"
        name="speciality-search"
        placeholder="Search or create service"
        className="service-search-input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="service-search-dropdown" id="speciality-search-listbox">
          {filtered?.length > 0 ? (
            filtered.map((service: any) => (
              <button
                key={service}
                className="service-search-speciality"
                onClick={() => handleSelect(service)}
              >
                <div className="service-search-speciality-title">{service}</div>
              </button>
            ))
          ) : (
            <button type="button" className="service-search-add" onClick={handleAdd}>
              Add service “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ServiceSearchBase;
