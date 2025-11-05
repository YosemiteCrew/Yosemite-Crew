import React, { useMemo } from "react";
import { MdDeleteForever } from "react-icons/md";
import ServiceSearch from "../../Inputs/ServiceSearch/ServiceSearch";

import "./SpecialityCard.css";

const SpecialityCard = ({ speciality, setSpecialities }: any) => {
  const filteredServices = useMemo(() => {
    return speciality.services.filter((s: any) => s.active);
  }, [speciality]);

  const handleDelete = () => {
    setSpecialities((prev: any) =>
      prev.map((s: any) =>
        s.key === speciality.key ? { ...s, active: false } : s
      )
    );
  };

  const handleToggle = (key: string, checked: boolean) => {
    setSpecialities((prev: any) =>
      prev.map((sp: any) => {
        if (sp.key !== speciality.key) return sp;
        return {
          ...sp,
          services: servicesMapper(sp.services, key, checked),
        };
      })
    );
  };

  const servicesMapper = (services: any, key: string, checked: boolean) =>
    services.map((svc: any) =>
      svc.name === key ? { ...svc, active: checked } : svc
    );

  return (
    <div className="speciality-container">
      <div className="speciality-title-container">
        <div className="speciality-title">{speciality.name}</div>
        <MdDeleteForever
          size={24}
          color="#EA3729"
          className="speciality-delete"
          onClick={handleDelete}
        />
      </div>
      <ServiceSearch
        speciality={speciality}
        setSpecialities={setSpecialities}
        handleToggle={handleToggle}
      />
      {filteredServices.length === 0 && (
        <div className="services-container-empty">
          Search and add services from the search bar above
        </div>
      )}
      <div className="speciality-services">
        {filteredServices.map((service: any) => (
          <label
            key={service.name}
            className="speciality-service"
            htmlFor={service.name}
          >
            <input
              type="checkbox"
              id={service.name}
              className="speciality-service-check"
              checked={service.active}
              onChange={(e) => handleToggle(service.name, e.target.checked)}
            />
            <div className="speciality-service-title">{service.name}</div>
          </label>
        ))}
      </div>
    </div>
  );
};

export default SpecialityCard;
