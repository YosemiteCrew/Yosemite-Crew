import React, { useEffect, useMemo, useRef, useState } from "react";
import { IoSearch } from "react-icons/io5";
import { specialtiesByKey } from "@/app/utils/specialities";
import { Service } from "@yosemite-crew/types";
import { SpecialityWeb } from "@/app/types/speciality";
import { useOrgStore } from "@/app/stores/orgStore";
import { createService } from "@/app/services/specialityService";

import "./ServiceSearch.css";

type SpecialityCardProps = {
  speciality: SpecialityWeb;
};

const ServiceSearchEdit = ({
  speciality
}: SpecialityCardProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const SERVICES = specialtiesByKey[speciality.name]?.services || [];
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

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
  }, [query, selectedNames, SERVICES]);

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

  const handleSelectService = async (serviceName: string) => {
    const newService = {
      name: serviceName,
      description: "",
      maxDiscount: 10,
      cost: 10,
      durationMinutes: 15,
      organisationId: primaryOrgId,
      specialityId: speciality._id,
    } as Service;
    try {
      await createService(newService);
    } catch (error) {
      console.log(error);
    } finally {
      setQuery("");
      setOpen(false);
    }
  };

  const handleAddService = async () => {
    const name = query.trim();
    if (!name) return;
    const newService = {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      description: "",
      maxDiscount: 10,
      cost: 10,
      durationMinutes: 15,
      organisationId: primaryOrgId,
      specialityId: speciality._id,
    } as Service;
    try {
      await createService(newService);
    } catch (error) {
      console.log(error);
    } finally {
      setQuery("");
      setOpen(false);
    }
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

export default ServiceSearchEdit;
