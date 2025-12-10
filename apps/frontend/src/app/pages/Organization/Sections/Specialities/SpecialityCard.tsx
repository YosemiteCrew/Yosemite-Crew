import Accordion from "@/app/components/Accordion/Accordion";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import ServiceSearch from "@/app/components/Inputs/ServiceSearch/ServiceSearch";
import { SpecialityWeb } from "@/app/types/speciality";
import { Service } from "@yosemite-crew/types";
import React from "react";

type SpecialityCardProps = {
  setFormData: React.Dispatch<React.SetStateAction<SpecialityWeb[]>>;
  speciality: SpecialityWeb;
  index: number;
};

const SpecialityCard = ({
  setFormData,
  speciality,
  index,
}: SpecialityCardProps) => {
  const updateServiceList = (
    serviceIndex: number,
    key: string,
    value: string,
    services: Service[] = []
  ): Service[] => {
    return services.map((srv, srvIndex) =>
      srvIndex === serviceIndex ? { ...srv, [key]: value } : srv
    );
  };

  const updateServiceField = (
    serviceIndex: number,
    key: string,
    value: string
  ) => {
    setFormData((prev) =>
      prev.map((sp, spIndex) => {
        if (spIndex !== index) return sp;
        return {
          ...sp,
          services: updateServiceList(serviceIndex, key, value, sp.services),
        };
      })
    );
  };

  const removeService = (serviceIndex: number) => {
    setFormData((prev) =>
      prev.map((sp, spIndex) => {
        if (spIndex !== index) return sp;
        return {
          ...sp,
          services: filterService(sp.services || [], serviceIndex),
        };
      })
    );
  };

  const filterService = (services: Service[], serviceIndex: number) => {
    return services?.filter((_, i) => i !== serviceIndex);
  };

  return (
    <div className="flex flex-col gap-3">
      <ServiceSearch speciality={speciality} setSpecialities={setFormData} />
      {speciality?.services?.map((service, i) => (
        <Accordion
          key={service.name}
          title={service.name}
          defaultOpen
          showEditIcon={false}
          isEditing={true}
          showDeleteIcon
          onDeleteClick={() => removeService(i)}
        >
          <div className="flex flex-col gap-3">
            <FormInput
              intype="text"
              inname="description"
              value={service.description || ""}
              inlabel="Description"
              onChange={(e) =>
                updateServiceField(i, "description", e.target.value)
              }
              className="min-h-12!"
            />
            <FormInput
              intype="number"
              inname="duration"
              value={String(service.durationMinutes)}
              inlabel="Duration (mins)"
              onChange={(e) =>
                updateServiceField(i, "durationMinutes", e.target.value)
              }
              className="min-h-12!"
            />
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                intype="number"
                inname="charge"
                value={String(service.cost)}
                inlabel="Service charge ($)"
                onChange={(e) =>
                  updateServiceField(i, "cost", e.target.value)
                }
                className="min-h-12!"
              />
              <FormInput
                intype="number"
                inname="max-discount"
                value={String(service.maxDiscount)}
                inlabel="Max discount (%)"
                onChange={(e) =>
                  updateServiceField(i, "maxDiscount", e.target.value)
                }
                className="min-h-12!"
              />
            </div>
          </div>
        </Accordion>
      ))}
    </div>
  );
};

export default SpecialityCard;
