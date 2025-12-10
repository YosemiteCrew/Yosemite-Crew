import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import React from "react";
import { formDataProps } from "..";
import { AppointmentsProps } from "@/app/types/appointments";
import Accordion from "@/app/components/Accordion/Accordion";
import ServiceCard from "../Prescription/ServiceCard";
import Image from "next/image";
import { Primary } from "@/app/components/Buttons";

const AppointmentFields = [
  { label: "Service", key: "service", type: "text" },
  { label: "Reason", key: "reason", type: "text" },
  { label: "Date", key: "date", type: "text" },
  { label: "Time", key: "time", type: "text" },
  { label: "Lead", key: "lead", type: "text" },
  { label: "Status", key: "status", type: "text" },
];

type SummaryProps = {
  formData: formDataProps;
  setFormData: React.Dispatch<React.SetStateAction<formDataProps>>;
  activeAppointment: AppointmentsProps;
};

const Summary = ({
  activeAppointment,
  formData,
  setFormData,
}: SummaryProps) => {
  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto">
      <div className="flex flex-col gap-6">
        <div className="font-grotesk font-medium text-black-text text-[23px]">
          Summary
        </div>
        <EditableAccordion
          key={"Appointments-key"}
          title={"Appointments details"}
          fields={AppointmentFields}
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
        <div className="flex flex-col px-4! py-2.5! rounded-2xl border border-grey-light">
          <div className="flex items-center justify-between pb-3 px-1">
            <div className="font-satoshi font-semibold text-black-text text-[23px]">
              Pay
            </div>
            <Image
              alt={"Powered by stripe"}
              src={"https://d2il6osz49gpup.cloudfront.net/payment/stripe.png"}
              height={30}
              width={120}
            />
          </div>
          <div className="px-3! py-2! flex items-center gap-2 border-b border-grey-light justify-between">
            <div>SubTotal: </div>
            <div>${formData.subtotal}</div>
          </div>
          <div className="px-3! py-2! flex items-center gap-2 border-b border-grey-light justify-between">
            <div>Tax: </div>
            <div>${formData.tax || "0.00"}</div>
          </div>
          <div className="px-3! py-2! flex items-center gap-2 border-b border-grey-light justify-between">
            <div>Estimatted total: </div>
            <div>${formData.total || "0.00"}</div>
          </div>
          <div className="font-satoshi font-semibold text-[15px] text-grey-noti px-3 py-2">
            <span className="text-[#247AED]">Note : </span>Yosemite Crew uses
            Stripe for secure payments. Your payment details are encrypted and
            never stored on our servers.
          </div>
        </div>
      </div>
      <Primary href="#" text="Pay" classname="h-13!" />
    </div>
  );
};

export default Summary;
