import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import { Secondary } from "@/app/components/Buttons";
import Close from "@/app/components/Icons/Close";
import Modal from "@/app/components/Modal";
import { useAppointmentsForPrimaryOrg } from "@/app/hooks/useAppointments";
import { formatDateLabel } from "@/app/utils/forms";
import { Invoice } from "@yosemite-crew/types";
import React, { useMemo } from "react";

const CompanionFields = [
  { label: "Pet", key: "pet", type: "text" },
  { label: "Parent", key: "parent", type: "text" },
  { label: "Service", key: "service", type: "text" },
];
const InvoiceFields = [
  { label: "Sub-total", key: "subTotal", type: "text" },
  { label: "Discount", key: "discount", type: "text" },
  { label: "Tax", key: "tax", type: "text" },
  { label: "Total", key: "total", type: "text" },
  { label: "Date", key: "date", type: "text" },
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
  const appointments = useAppointmentsForPrimaryOrg();

  const handleGenerate = () => {};

  const handleDownload = (link: string | undefined) => {
    window.open(link, "_blank");
  };

  const appointmentInfoData = useMemo(() => {
    const appointment = appointments.filter(
      (a) => a.id === activeInvoice?.appointmentId,
    );
    if (appointment.length > 0) {
      return {
        pet: appointment[0].companion.name,
        parent: appointment[0].companion.parent.name,
        service: appointment[0].appointmentType?.name,
      };
    }
    return {
      pet: "-",
      parent: "-",
      service: "-",
    };
  }, [activeInvoice, appointments]);

  const paymentInfoData = useMemo(
    () => ({
      subTotal: "$" + (activeInvoice?.subtotal ?? "0"),
      discount: "$" + (activeInvoice?.discountTotal ?? "0"),
      tax: "$" + (activeInvoice?.taxTotal ?? "0"),
      total: "$" + (activeInvoice?.totalAmount ?? "0"),
      date: formatDateLabel(activeInvoice?.createdAt),
    }),
    [activeInvoice],
  );

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
              data={appointmentInfoData}
              defaultOpen={true}
              showEditIcon={false}
            />
            <EditableAccordion
              key={"Payments-key"}
              title={"Payment details"}
              fields={InvoiceFields}
              data={paymentInfoData}
              defaultOpen={true}
              showEditIcon={false}
            />
          </div>
          <div className="flex flex-col gap-3 mt-2">
            {activeInvoice?.stripeReceiptUrl ? (
              <Secondary
                text="Download"
                href=""
                onClick={() => handleDownload(activeInvoice.stripeReceiptUrl)}
              />
            ) : (
              <Secondary
                text="Generate link"
                href="#"
                onClick={handleGenerate}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default InvoiceInfo;
