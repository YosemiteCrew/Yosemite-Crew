import AccordionButton from "@/app/components/Accordion/AccordionButton";
import React, { useMemo } from "react";
import ProfileCard from "./ProfileCard";
import {
  useCounterForPrimaryOrg,
  useSubscriptionForPrimaryOrg,
} from "@/app/hooks/useBilling";
import { toTitle } from "@/app/utils/validators";
import { PermissionGate } from "@/app/components/PermissionGate";
import { PERMISSIONS } from "@/app/utils/permissions";
import { field, ProfileField } from "./Profile";

const BasicFields: ProfileField[] = [
  field("Current plan", "plan", "text", false),
  field("Next invoice date", "nextInvoiceDate", "date", false),
  field("Joining date", "joiningDate", "date"),
  field("Appointments", "appointments", "country"),
  field("Observational tools", "obervationalTools", "text", true, false),
  field("Members", "members"),
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
    [subscription, counter],
  );

  return (
    <PermissionGate allOf={[PERMISSIONS.SUBSCRIPTION_VIEW_ANY]}>
      <AccordionButton title="Payment" showButton={false} finance>
        <div className="flex flex-col gap-4">
          <ProfileCard
            title="Plan overview"
            fields={BasicFields}
            org={values}
          />
        </div>
      </AccordionButton>
    </PermissionGate>
  );
};

export default Payment;
