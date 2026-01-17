import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import { Primary, Secondary } from "@/app/components/Buttons";
import Close from "@/app/components/Icons/Close";
import Modal from "@/app/components/Modal";
import { Invoice } from "@yosemite-crew/types";
import React from "react";

const CompanionFields = [
  { label: "Pet", key: "pet", type: "text" },
  { label: "Parent", key: "parent", type: "text" },
  { label: "Appointment ID", key: "appointmentId", type: "text" },
  { label: "service", key: "service", type: "text" },
];
const InvoiceFields = [
  { label: "Sub-total", key: "subtotal", type: "text" },
  { label: "Tax", key: "tax", type: "text" },
  { label: "Total", key: "total", type: "text" },
  { label: "Date", key: "date", type: "text" },
  { label: "Time", key: "time", type: "text" },
  { label: "Payment link", key: "paymentLink", type: "text" },
];

type InvoiceInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeInvoice: Invoice | null;
};

const InvoiceInfo = ({
  showModal,
  setShowModal,
  activeInvoice,
}: InvoiceInfoProps) => {
  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">View invoice</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>
        <div className="flex overflow-y-auto flex-1 justify-between flex-col gap-6 w-full scrollbar-hidden">
          <div className="flex flex-col gap-6 w-full">
            <EditableAccordion
              key={"Appointments-key"}
              title={"Appointments details"}
              fields={CompanionFields}
              data={activeInvoice?.metadata || []}
              defaultOpen={true}
            />
            <EditableAccordion
              key={"Payments-key"}
              title={"Payment details"}
              fields={InvoiceFields}
              data={activeInvoice || []}
              defaultOpen={true}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Secondary href="#" text="Print" className="h-13!" />
            <Primary
              href="#"
              text="Mail Payment link"
              classname="h-13! text-[18px]!"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default InvoiceInfo;
