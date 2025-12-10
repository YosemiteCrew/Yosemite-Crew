import Accordion from "@/app/components/Accordion/Accordion";
import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import { Primary, Secondary } from "@/app/components/Buttons";
import { AppointmentsProps } from "@/app/types/appointments";
import React from "react";
import { formDataProps } from "..";
import ServiceCard from "./ServiceCard";

const AppointmentFields = [
  { label: "Service", key: "service", type: "text" },
  { label: "Reason", key: "reason", type: "text" },
  { label: "Date", key: "date", type: "text" },
  { label: "Time", key: "time", type: "text" },
  { label: "Lead", key: "lead", type: "text" },
];

const DiagonisisFields = [
  { label: "Differential", key: "differential", type: "text" },
  { label: "Prognosis", key: "prognosis", type: "text" },
];

type DischargeSummaryProps = {
  formData: formDataProps;
  setFormData: React.Dispatch<React.SetStateAction<formDataProps>>;
  activeAppointment: AppointmentsProps;
};

const Discharge = ({
  activeAppointment,
  formData,
  setFormData,
}: DischargeSummaryProps) => {
  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto">
      <div className="flex flex-col gap-6">
        <div className="font-grotesk font-medium text-black-text text-[23px]">
          Discharge summary
        </div>
        <EditableAccordion
          key={"Appointments-key"}
          title={"Appointments details"}
          fields={AppointmentFields}
          data={activeAppointment}
          defaultOpen={true}
          showEditIcon={false}
        />
        <EditableAccordion
          key={"diagonisis-key"}
          title={"Diagnosis"}
          fields={DiagonisisFields}
          data={activeAppointment}
          defaultOpen={true}
          showEditIcon={false}
        />
        <Accordion
          title="Procedures & treatments"
          defaultOpen={true}
          showEditIcon={false}
          isEditing={true}
        >
          {formData.services.length > 0 && (
            <div className="flex flex-col gap-1 px-2">
              {formData.services.map((service, i) => (
                <ServiceCard
                  service={service}
                  key={service.name + i}
                  setFormData={setFormData}
                  edit={false}
                />
              ))}
            </div>
          )}
        </Accordion>
        <Accordion
          title="Medications"
          defaultOpen={true}
          showEditIcon={false}
          isEditing={true}
        ></Accordion>
        <Accordion
          title="Important note"
          defaultOpen={true}
          showEditIcon={false}
          isEditing={true}
        >
          {formData.notes && (
            <div className="px-4! py-2.5! rounded-2xl border border-grey-light font-satoshi text-black-text text-[15px] font-semibold">
              {formData.notes}
            </div>
          )}
        </Accordion>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.followUp}
            onChange={() =>
              setFormData((prev) => ({ ...prev, followUp: !prev.followUp }))
            }
          />
          <div className="font-satoshi text-black-text text-[16px] font-semibold">
            Require a follow-up appointment
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Primary
          href="#"
          text="Save and share with parents"
          classname="h-13!"
        />
        <Secondary href="#" text="Save" className="h-13!" />
      </div>
    </div>
  );
};

export default Discharge;
