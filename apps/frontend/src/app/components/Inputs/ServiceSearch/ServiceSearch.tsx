import React, { useEffect, useMemo, useRef, useState } from "react";
import { IoSearch } from "react-icons/io5";
import { specialtiesByKey } from "@/app/utils/specialities";
import { Service } from "@yosemite-crew/types";
import { SpecialityWeb } from "@/app/types/speciality";

import "./ServiceSearch.css";
import { useOrgStore } from "@/app/stores/orgStore";

type SpecialityCardProps = {
  speciality: SpecialityWeb;
  setSpecialities: React.Dispatch<React.SetStateAction<SpecialityWeb[]>>;
};

const ServiceSearch = ({
  speciality,
  setSpecialities,
}: SpecialityCardProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const SERVICES = specialtiesByKey[speciality.name].services;
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId)

  const selectedNames = useMemo(
    () =>
      new Set(
        (speciality.services || []).map((s: Service) => s.name.toLowerCase())
      ),
    [speciality]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SERVICES.filter((s: any) => {
      const name = s.toLowerCase();
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

  const handleSelectService = (serviceName: string) => {
    setSpecialities((prev: SpecialityWeb[]) =>
      prev.map((sp) => {
        if (sp.name.toLowerCase() !== speciality.name.toLowerCase()) return sp;
        const exists = checkIfAlready(serviceName, sp.services || []);
        if (exists) return sp;
        return {
          ...sp,
          services: [
            ...(sp.services ?? []),
            {
              name: serviceName,
              description: "",
              maxDiscount: 10,
              cost: 10,
              durationMinutes: 15,
              organisationId: primaryOrgId
            } as Service,
          ],
        };
      })
    );
    setQuery("");
    setOpen(false);
  };

  const handleAddService = () => {
    const name = query.trim();
    if (!name) return;
    setSpecialities((prev: SpecialityWeb[]) =>
      prev.map((sp) => {
        if (sp.name.toLowerCase() !== speciality.name.toLowerCase()) return sp;
        const exists = checkIfAlready(name, sp.services || []);
        if (exists) return sp;
        return {
          ...sp,
          services: [
            ...(sp.services ?? []),
            {
              name: name.charAt(0).toUpperCase() + name.slice(1),
              description: "",
              maxDiscount: 10,
              cost: 15,
              durationMinutes: 15,
              organisationId: primaryOrgId
            } as Service,
          ],
        };
      })
    );
    setQuery("");
    setOpen(false);
  };

  const checkIfAlready = (name: string, services: Service[] = []) =>
    services.some((s) => s.name.toLowerCase() === name.toLowerCase());

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
                onClick={() => handleSelectService(service)}
              >
                <div className="service-search-speciality-title">{service}</div>
              </button>
            ))
          ) : (
            <button
              type="button"
              className="service-search-add"
              onClick={() => handleAddService()}
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
