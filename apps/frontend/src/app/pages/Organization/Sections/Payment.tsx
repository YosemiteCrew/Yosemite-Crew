import AccordionButton from "@/app/components/Accordion/AccordionButton";
import SmallAccordionButton from "@/app/components/Accordion/SmallAccordionButton";
import InvoiceDataTable from "@/app/components/DataTable/InvoiceTable";
import React from "react";
import ProfileCard from "./ProfileCard";
import { useInvoicesForPrimaryOrg } from "@/app/hooks/useInvoices";

const BasicFields = [
  {
    label: "Current plan",
    key: "plan",
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Next invoice date",
    key: "cycleDate",
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Joining date",
    key: "joiningDate",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Appointments",
    key: "appointments",
    required: true,
    editable: true,
    type: "country",
  },
  {
    label: "Observational tools",
    key: "obervationalTools",
    required: false,
    editable: true,
    type: "text",
  },
  {
    label: "Members",
    key: "members",
    required: true,
    editable: true,
    type: "text",
  },
];

const BillingFields = [
  {
    label: "Name",
    key: "name",
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Email",
    key: "email",
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Address",
    key: "address",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Tax Id",
    key: "taxId",
    required: true,
    editable: true,
    type: "country",
  },
  {
    label: "Country",
    key: "country",
    required: false,
    editable: true,
    type: "text",
  },
];

const Payment = () => {
  const invoices = useInvoicesForPrimaryOrg();

  return (
    <AccordionButton title="Payment" showButton={false}>
      <div className="flex flex-col gap-4">
        <ProfileCard
          title="Plan overview"
          fields={BasicFields}
          org={{
            plan: "Free",
            cycleDate: "-",
            joiningDate: "-",
            appointments: "0",
            obervationalTools: "0",
            members: "0",
          }}
        />
        <ProfileCard
          title="Billing details"
          fields={BillingFields}
          org={{
            name: "-",
            address: "-",
            email: "-",
            taxId: "-",
            country: "-",
          }}
        />
        <SmallAccordionButton title="Invoices" showButton={false}>
          <InvoiceDataTable filteredList={invoices} />
        </SmallAccordionButton>
      </div>
    </AccordionButton>
  );
};

export default Payment;
