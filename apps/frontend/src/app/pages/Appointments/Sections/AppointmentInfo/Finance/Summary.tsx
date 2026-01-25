import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import React, { useMemo } from "react";
import { FormDataProps } from "..";
import Image from "next/image";
import { Appointment } from "@yosemite-crew/types";
import { AppointmentStatusOptions } from "@/app/types/appointments";
import { PermissionGate } from "@/app/components/PermissionGate";
import { PERMISSIONS } from "@/app/utils/permissions";
import Fallback from "@/app/components/Fallback";

const AppointmentFields = [
  { label: "Service", key: "service", type: "text" },
  { label: "Reason", key: "concern", type: "text" },
  { label: "Date", key: "date", type: "date" },
  { label: "Time", key: "time", type: "time" },
  { label: "Lead", key: "lead", type: "text" },
  {
    label: "Status",
    key: "status",
    type: "select",
    options: AppointmentStatusOptions,
  },
];

type SummaryProps = {
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
  activeAppointment: Appointment;
};

const Summary = ({
  activeAppointment,
  formData,
  setFormData
}: SummaryProps) => {
  const AppointmentInfoData = useMemo(
    () => ({
      concern: activeAppointment.concern ?? "",
      service: activeAppointment.appointmentType?.name ?? "",
      date: activeAppointment.appointmentDate ?? "",
      time: activeAppointment.startTime ?? "",
      lead: activeAppointment.lead?.name ?? "",
      status: activeAppointment.status ?? "",
    }),
    [activeAppointment],
  );

  return (
    <PermissionGate
      allOf={[PERMISSIONS.BILLING_VIEW_ANY]}
      fallback={<Fallback />}
    >
      <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto scrollbar-hidden">
        <div className="flex flex-col gap-6">
          <EditableAccordion
            key={"Appointments-key"}
            title={"Appointments details"}
            fields={AppointmentFields}
            data={AppointmentInfoData}
            defaultOpen={true}
            showEditIcon={false}
          />
          <div className="flex flex-col px-3! py-3! rounded-2xl border border-card-border">
            <div className="flex items-center justify-between mb-3">
              <div className="text-body-1 text-text-primary">Pay</div>
              <Image
                alt={"Powered by stripe"}
                src={"https://d2il6osz49gpup.cloudfront.net/payment/stripe.png"}
                height={30}
                width={120}
              />
            </div>
            <div className="py-2! flex items-center gap-2 border-b border-card-border justify-between">
              <div className="text-body-4-emphasis text-text-tertiary">
                SubTotal:{" "}
              </div>
              <div className="text-body-4 text-text-primary text-right">
                ${formData.subTotal || "0"}
              </div>
            </div>
            <div className="py-2! flex items-center gap-2 border-b border-card-border justify-between">
              <div className="text-body-4-emphasis text-text-tertiary">
                Discount:{" "}
              </div>
              <div className="text-body-4 text-text-primary text-right">
                ${formData.discount || "0"}
              </div>
            </div>
            <div className="py-2! flex items-center gap-2 border-b border-card-border justify-between">
              <div className="text-body-4-emphasis text-text-tertiary">
                Tax:{" "}
              </div>
              <div className="text-body-4 text-text-primary text-right">
                ${formData.tax || "0"}
              </div>
            </div>
            <div className="py-2! flex items-center gap-2 border-b border-card-border justify-between">
              <div className="text-body-4-emphasis text-text-tertiary">
                Estimatted total:{" "}
              </div>
              <div className="text-body-4 text-text-primary text-right">
                ${formData.total || "0"}
              </div>
            </div>
            <div className="text-caption-1 text-text-secondary py-2">
              <span className="text-[#247AED]">Note : </span>Yosemite Crew uses
              Stripe for secure payments. Your payment details are encrypted and
              never stored on our servers.
            </div>
          </div>
        </div>
      </div>
    </PermissionGate>
  );
};

export default Summary;
