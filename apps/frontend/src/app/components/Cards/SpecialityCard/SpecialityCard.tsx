import React, { useMemo } from "react";
import { MdDeleteForever, MdOutlineClose } from "react-icons/md";
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

  const handleToggle = (key: string) => {
    setSpecialities((prev: any) =>
      prev.map((sp: any) => {
        if (sp.key !== speciality.key) return sp;
        return {
          ...sp,
          services: servicesMapper(sp.services, key),
        };
      })
    );
  };

  const servicesMapper = (services: any, key: string) =>
    services.map((svc: any) =>
      svc.name === key ? { ...svc, active: !svc.active } : svc
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
          <div key={service.name} className="speciality-service">
            <div className="speciality-service-title">{service.name}</div>
            <MdOutlineClose
              onClick={() => handleToggle(service.name)}
              size={20}
              color="#302f2e"
              className="cursor-pointer"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpecialityCard;
