import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import React, { useMemo } from "react";
import { FormDataProps } from "..";
import Image from "next/image";
import { Primary } from "@/app/components/Buttons";
import { Appointment } from "@yosemite-crew/types";

const AppointmentFields = [
  { label: "Service", key: "service", type: "text" },
  { label: "Reason", key: "concern", type: "text" },
  { label: "Date", key: "date", type: "date" },
  { label: "Time", key: "time", type: "date" },
  { label: "Lead", key: "lead", type: "text" },
  { label: "Status", key: "status", type: "text" },
];

type SummaryProps = {
  formData: FormDataProps;
  setFormData: React.Dispatch<React.SetStateAction<FormDataProps>>;
  activeAppointment: Appointment;
};

const Summary = ({
  activeAppointment,
  formData,
  setFormData,
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
    [activeAppointment]
  );

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
          data={AppointmentInfoData}
          defaultOpen={true}
          showEditIcon={false}
        />
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
            <div>${formData.subTotal}</div>
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
