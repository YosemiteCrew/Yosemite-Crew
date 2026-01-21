import AccordionButton from "@/app/components/Accordion/AccordionButton";
import React, { useMemo } from "react";
import ProfileCard from "./ProfileCard";
import {
  useCounterForPrimaryOrg,
  useSubscriptionForPrimaryOrg,
} from "@/app/hooks/useBilling";
import { toTitle } from "@/app/utils/validators";

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
    key: "nextInvoiceDate",
    required: true,
    editable: false,
    type: "date",
  },
  {
    label: "Joining date",
    key: "joiningDate",
    required: true,
    editable: true,
    type: "date",
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

const Payment = () => {
  const subscription = useSubscriptionForPrimaryOrg();
  const counter = useCounterForPrimaryOrg();

  const values = useMemo(
    () => ({
      plan: toTitle(subscription?.plan),
      joiningDate: subscription?.joinedAt,
      nextInvoiceDate: subscription?.nextInvoiceAt,
      appointments: counter?.appointmentsUsed || "0",
      obervationalTools: counter?.toolsUsed || "0",
      members: counter?.usersBillableCount,
    }),
    [subscription, counter]
  );

  return (
    <AccordionButton title="Payment" showButton={false} finance>
      <div className="flex flex-col gap-4">
        <ProfileCard title="Plan overview" fields={BasicFields} org={values} />
      </div>
    </AccordionButton>
  );
};

export default Payment;
