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
    <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto">
      <div className="flex flex-col gap-6">
        <div className="font-grotesk font-medium text-black-text text-[23px]">
          Payment details
        </div>
        {payments.map((payment) => (
          <Accordion
            key={payment.appointmentId}
            title={payment.paymentId}
            defaultOpen={true}
            showEditIcon={false}
            isEditing={true}
          >
            <div className="flex flex-col px-4! py-2.5! rounded-2xl border border-grey-light">
              <div className="px-3! py-2! flex items-center gap-2 border-b border-grey-light justify-between">
                <div>Appointent ID: </div>
                <div>{payment.appointmentId}</div>
              </div>
              <div className="px-3! py-2! flex items-center gap-2 border-b border-grey-light justify-between">
                <div>Payment ID: </div>
                <div>{payment.paymentId}</div>
              </div>
              <div className="px-3! py-2! flex items-center gap-2 border-b border-grey-light justify-between">
                <div>Payment method: </div>
                <div>{payment.mode}</div>
              </div>
              <div className="px-3! py-2! flex items-center gap-2 border-b border-grey-light justify-between">
                <div>Date & Time: </div>
                <div>{payment.date + payment.time}</div>
              </div>
              <div className="px-3! py-2! flex items-center gap-2 justify-between">
                <div>Amount: </div>
                <div>${payment.amount}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 py-3">
              <Secondary href="#" text="Print invoice" className="h-13!" />
              <Secondary href="#" text="Email invoice" className="h-13!" />
            </div>
          </Accordion>
        ))}
      </div>
    </div>
  );
};

export default Details;
