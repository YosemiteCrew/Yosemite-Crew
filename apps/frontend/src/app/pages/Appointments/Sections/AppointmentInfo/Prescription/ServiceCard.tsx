import Accordion from "@/app/components/Accordion/Accordion";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import React from "react";
import { ServiceEdit } from "..";

type ServiceCardProps = {
  service: ServiceEdit;
  setFormData: any;
  edit?: boolean;
};

const ServiceCard = ({
  service,
  setFormData,
  edit = true,
}: ServiceCardProps) => {
  const removeService = () => {
    setFormData((prev: any) => ({
      ...prev,
      services: prev.services.filter(
        (s: ServiceEdit) => s.name !== service.name
      ),
    }));
  };

  const setDiscount = (value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      services: prev.services.map((s: any) =>
        s.name === service.name ? { ...s, discount: value } : s
      ),
    }));
  };

  return (
    <Accordion
      key={service.name}
      title={service.name}
      defaultOpen
      showEditIcon={false}
      isEditing={true}
      showDeleteIcon={edit}
      onDeleteClick={removeService}
    >
      <div className="flex flex-col px-4! py-2.5! rounded-2xl border border-grey-light">
        <div className="px-3! py-2! flex items-center gap-2 border-b border-grey-light justify-between">
          <div>Name: </div>
          <div>{service.name}</div>
        </div>
        <div className="px-3! py-2! flex items-center gap-3 border-b border-grey-light justify-between">
          <div>Description: </div>
          <div className="text-right">{service.description}</div>
        </div>
        <div className="px-3! py-2! flex items-center gap-2 border-b border-grey-light justify-between">
          <div>Duration: </div>
          <div>{service.durationMinutes + " mins"}</div>
        </div>
        <div className={`px-3! py-2! flex items-center gap-2 justify-between ${!edit && "border-b border-grey-light"}`}>
          <div>Charges: </div>
          <div>${service.cost}</div>
        </div>
        {edit ? (
          <div className="px-2 py-3">
            <FormInput
              intype="number"
              inname="discount"
              value={service.discount}
              inlabel="Discount (%)"
              onChange={(e) => setDiscount(e.target.value)}
              className="min-h-12!"
            />
          </div>
        ) : (
          <div className="px-3! py-2! flex items-center gap-2 justify-between">
            <div>Discount (%): </div>
            <div>{service.discount || "0"}%</div>
          </div>
        )}
      </div>
    </Accordion>
  );
};

export default ServiceCard;
