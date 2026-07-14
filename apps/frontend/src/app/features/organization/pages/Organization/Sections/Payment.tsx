import AccordionButton from '@/app/ui/primitives/Accordion/AccordionButton';
import React, { useMemo } from 'react';
import ProfileCard from '@/app/features/organization/pages/Organization/Sections/ProfileCard';
import { useCounterForPrimaryOrg, useSubscriptionForPrimaryOrg } from '@/app/hooks/useBilling';
import { toTitle } from '@/app/lib/validators';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import {
  field,
  ProfileField,
} from '@/app/features/organization/pages/Organization/Sections/profileFields';
import StripeSettingsButton from '@/app/features/billing/components/StripeSettingsButton';

const BasicFields: ProfileField[] = [
  field('Current plan', 'plan', 'text', false),
  field('Next invoice date', 'nextInvoiceDate', 'date', false),
  field('Joining date', 'joiningDate', 'date'),
  field('Appointments', 'appointments', 'text', false),
  field('Observational tools', 'obervationalTools', 'text', true, false),
  field('Users', 'members', 'text', false),
];

const formatUsage = (used?: number, limit?: number): string => {
  if (typeof used !== 'number' && typeof limit !== 'number') return '0';
  if (typeof limit !== 'number') return String(used ?? 0);
  return `${used ?? 0} / ${limit}`;
};

const Payment = () => {
  const subscription = useSubscriptionForPrimaryOrg();
  const counter = useCounterForPrimaryOrg();

  const values = useMemo(
    () => ({
      plan: toTitle(subscription?.plan),
      joiningDate: subscription?.joinedAt,
      nextInvoiceDate: subscription?.nextInvoiceAt,
      appointments: formatUsage(counter?.appointmentsUsed, counter?.freeAppointmentsLimit),
      obervationalTools: formatUsage(counter?.toolsUsed, counter?.freeToolsLimit),
      members: formatUsage(counter?.usersBillableCount, counter?.freeUsersLimit),
    }),
    [subscription, counter]
  );

  return (
    <PermissionGate allOf={[PERMISSIONS.SUBSCRIPTION_VIEW_ANY]}>
      <AccordionButton
        title="Payment"
        showButton={false}
        finance
        actions={<StripeSettingsButton />}
      >
        <div className="flex flex-col gap-4">
          <ProfileCard title="Plan overview" fields={BasicFields} org={values} />
        </div>
      </AccordionButton>
    </PermissionGate>
  );
};

export default Payment;
