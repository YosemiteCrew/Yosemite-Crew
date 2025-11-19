import React, { useEffect, useMemo, useRef, useState } from "react";
import { IoSearch } from "react-icons/io5";

import "./ServiceSearch.css";

const ServiceSearch = ({ speciality, setSpecialities, handleToggle }: any) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = speciality.services.filter((s: any) => !s.active);
    if (!q) return list;
    return list.filter((s: any) =>
      s.name.toLowerCase().includes(q)
    );
  }, [query, speciality]);

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

  const handleAddService = () => {
    const name = query.trim();
    if (!name) return;
    setSpecialities((prev: any[]) =>
      prev.map((sp: any) => {
        if (sp.key !== speciality.key) return sp;
        const services = sp.services || [];
        const exists = checkIfServiceExists(services, name)
        if (exists) return sp;
        const newService = {
          name,
          active: true,
          duration: 20,
          price: 50,
        };
        return { ...sp, services: [newService, ...services] };
      })
    );
    setQuery("");
    setOpen(false);
  };

  const checkIfServiceExists = (services: any, name: any) =>
    services.some((svc: any) => svc.name.toLowerCase() === name.toLowerCase());

  return (
    <div className="service-search" ref={wrapperRef}>
      <IoSearch size={24} className="service-search-icon" color="#302F2E" />
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
                key={service.name}
                className="service-search-speciality"
                onClick={() => handleToggle(service.name)}
              >
                <div className="service-search-speciality-title">
                  {service.name}
                </div>
              </button>
            ))
          ) : (
            <button
              type="button"
              className="service-search-add"
              onClick={handleAddService}
            >
              Add service “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ServiceSearch;
