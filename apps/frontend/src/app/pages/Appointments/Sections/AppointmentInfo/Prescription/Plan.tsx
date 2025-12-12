import Accordion from "@/app/components/Accordion/Accordion";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import { serviceOptions, allServices } from "@/app/pages/Organization/demo";
import React, { useEffect, useMemo, useState } from "react";
import ServiceCard from "./ServiceCard";
import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";
import { Primary } from "@/app/components/Buttons";
import { formDataProps } from "..";
import { AppointmentsProps } from "@/app/types/appointments";

type PlanProps = {
  formData: formDataProps;
  setFormData: React.Dispatch<React.SetStateAction<formDataProps>>;
  activeAppointment: AppointmentsProps;
};

const Plan = ({ formData, setFormData, activeAppointment }: PlanProps) => {
  const [suggestionsQuery, setSuggestionsQuery] = useState("");
  const [servicesQuery, setServicesQuery] = useState("");
  const [medicationsQuery, setMedicationsQuery] = useState("");
  const [planQuery, setPlanQuery] = useState("");

  const filteredServiceOptions = useMemo(() => {
    return serviceOptions.filter(
      (option) =>
        !formData.services.some((selected) => selected.name === option.key)
    );
  }, [formData.services]);

  const filteredSugesstionsOptions = useMemo(() => {
    return serviceOptions.filter(
      (option) =>
        !formData.suggestions.some((selected) => selected.name === option.key)
    );
  }, [formData.suggestions]);

  const handleServiceSelect = (key: string) => {
    const selected = allServices.find((s) => s.name === key);
    if (!selected) return;
    setFormData((prev) => ({
      ...prev,
      services: [...prev.services, { ...selected, discount: "" }],
    }));
  };

  const handleSugesstionSelect = (key: string) => {
    const selected = allServices.find((s) => s.name === key);
    if (!selected) return;
    setFormData((prev) => ({
      ...prev,
      suggestions: [...prev.suggestions, { ...selected, discount: "" }],
    }));
  };

  useEffect(() => {
    const tax = Number(formData.tax);
    const subtotal = formData.services.reduce((sum, service) => {
      const charge = Number(service.charge) || 0;
      const maxDiscount = Number(service.maxDiscount) || 0;
      const enteredDiscount = Number(service.discount) || 0;
      const appliedDiscount = Math.min(enteredDiscount, maxDiscount);
      const net = Math.max(charge - appliedDiscount, 0);
      return sum + net;
    }, 0);
    setFormData((prev) => ({
      ...prev,
      subtotal: subtotal.toFixed(2),
      total: (subtotal - tax).toFixed(2),
    }));
  }, [formData.services]);

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="font-grotesk font-medium text-black-text text-[23px]">
            Treatment/Plan
          </div>
          <SearchDropdown
            placeholder="Search plan"
            options={filteredServiceOptions}
            onSelect={handleServiceSelect}
            query={planQuery}
            setQuery={setPlanQuery}
          />
        </div>
        <Accordion
          title="Services"
          defaultOpen={false}
          showEditIcon={false}
          isEditing={true}
        >
          <div className="flex flex-col gap-3">
            <SearchDropdown
              placeholder="Search services"
              options={filteredServiceOptions}
              onSelect={handleServiceSelect}
              query={servicesQuery}
              setQuery={setServicesQuery}
            />
            {formData.services.length > 0 && (
              <div className="flex flex-col gap-1 px-2">
                {formData.services.map((service, i) => (
                  <ServiceCard
                    service={service}
                    key={service.name + i}
                    setFormData={setFormData}
                  />
                ))}
              </div>
            )}
          </div>
        </Accordion>
        <Accordion
          title="Medications"
          defaultOpen={false}
          showEditIcon={false}
          isEditing={true}
        >
          <div className="flex flex-col gap-3">
            <SearchDropdown
              placeholder="Search medications"
              options={filteredServiceOptions}
              onSelect={handleServiceSelect}
              query={medicationsQuery}
              setQuery={setMedicationsQuery}
            />
          </div>
        </Accordion>
        <Accordion
          title="Suggestions"
          defaultOpen={false}
          showEditIcon={false}
          isEditing={true}
        >
          <div className="flex flex-col gap-3">
            <SearchDropdown
              placeholder="Search services"
              options={filteredSugesstionsOptions}
              onSelect={handleSugesstionSelect}
              query={suggestionsQuery}
              setQuery={setSuggestionsQuery}
            />
            {formData.suggestions.length > 0 && (
              <div className="flex flex-col gap-1 px-2">
                {formData.suggestions.map((service, i) => (
                  <ServiceCard
                    service={service}
                    key={service.name + i}
                    setFormData={setFormData}
                  />
                ))}
              </div>
            )}
          </div>
        </Accordion>
        <div className="flex flex-col px-4! py-2.5! rounded-2xl border border-grey-light">
          <div className="px-3! py-2! flex items-center gap-2 border-b border-grey-light justify-between">
            <div>SubTotal: </div>
            <div>${formData.subtotal}</div>
          </div>
          <div className="px-3! py-2! flex items-center gap-2 border-b border-grey-light justify-between">
            <div>Tax: </div>
            <div>${formData.tax || "0.00"}</div>
          </div>
          <div className="px-3! py-2! flex items-center gap-2 justify-between">
            <div>Estimatted total: </div>
            <div>${formData.total || "0.00"}</div>
          </div>
        </div>
        <FormDesc
          intype="text"
          inname="notes"
          value={formData.notes}
          inlabel="Additional Notes"
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="min-h-[120px]!"
        />
      </div>
      <Primary href="#" text="Save" classname="h-13!" />
    </div>
  );
};

export default Plan;
