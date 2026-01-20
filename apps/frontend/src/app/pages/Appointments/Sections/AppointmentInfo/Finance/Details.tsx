import Accordion from "@/app/components/Accordion/Accordion";
import React, { useState } from "react";
import { DemoPayments } from "./demo";
import { Secondary } from "@/app/components/Buttons";

export type Payment = {
  appointmentId: string;
  paymentId: string;
  mode: string;
  date: string;
  time: string;
  status: string;
  amount: string;
};

const Details = () => {
  const [payments] = useState<Payment[]>(DemoPayments);

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto scrollbar-hidden">
      <div className="flex flex-col gap-6">
        {payments.map((payment) => (
          <Accordion
            key={payment.appointmentId}
            title={payment.paymentId}
            defaultOpen={true}
            showEditIcon={false}
            isEditing={true}
          >
            <div className="flex flex-col">
              <div className="py-2! flex items-center gap-2 border-b border-grey-light justify-between">
                <div className="text-body-4-emphasis text-text-tertiary">
                  Appointent ID:{" "}
                </div>
                <div className="text-body-4 text-text-primary text-right">
                  {payment.appointmentId}
                </div>
              </div>
              <div className="py-2! flex items-center gap-2 border-b border-grey-light justify-between">
                <div className="text-body-4-emphasis text-text-tertiary">
                  Payment ID:{" "}
                </div>
                <div className="text-body-4 text-text-primary text-right">
                  {payment.paymentId}
                </div>
              </div>
              <div className="py-2! flex items-center gap-2 border-b border-grey-light justify-between">
                <div className="text-body-4-emphasis text-text-tertiary">
                  Payment method:{" "}
                </div>
                <div className="text-body-4 text-text-primary text-right">
                  {payment.mode}
                </div>
              </div>
              <div className="py-2! flex items-center gap-2 border-b border-grey-light justify-between">
                <div className="text-body-4-emphasis text-text-tertiary">
                  Date & Time:{" "}
                </div>
                <div className="text-body-4 text-text-primary text-right">
                  {payment.date + payment.time}
                </div>
              </div>
              <div className="py-2! flex items-center gap-2 justify-between">
                <div className="text-body-4-emphasis text-text-tertiary">
                  Amount:{" "}
                </div>
                <div className="text-body-4 text-text-primary text-right">
                  ${payment.amount}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 py-2">
              <Secondary href="#" text="Print invoice" />
              <Secondary href="#" text="Email invoice" />
            </div>
          </Accordion>
        ))}
      </div>
    </div>
  );
};

export default Details;
