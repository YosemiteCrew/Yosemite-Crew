import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import { useParentStore } from '@/app/stores/parentStore';
import { getAppointmentCompanion } from '@/app/lib/appointments';

type InvoiceBilledToProps = {
  parentId?: string;
  appointment?: Appointment;
};

type ParentLike = Partial<{
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phoneNumber: string;
  address: Partial<{
    addressLine: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>;
}>;

const joinTruthy = (parts: Array<string | undefined>, separator: string): string =>
  parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(separator);

const InvoiceBilledTo = ({ parentId, appointment }: InvoiceBilledToProps) => {
  const storedParent = useParentStore((state) => (parentId ? state.getParentById(parentId) : null));
  const appointmentParent = (
    appointment ? getAppointmentCompanion(appointment).parent : undefined
  ) as ParentLike | undefined;

  const parent: ParentLike = storedParent ?? appointmentParent ?? {};

  const fullName =
    joinTruthy([parent.firstName, parent.lastName], ' ') || (parent.name ?? '').trim();
  const cityLine = joinTruthy([parent.address?.postalCode, parent.address?.city], ' ');
  const streetLine = joinTruthy([parent.address?.addressLine, cityLine], ', ');
  const contactLine = joinTruthy([parent.email, parent.phoneNumber], ' · ');

  const hasDetails = Boolean(fullName || streetLine || contactLine);

  return (
    <section
      className="rounded-[14px] border border-card-border px-4 py-3.5 flex flex-col gap-2"
      aria-label="Billed to"
    >
      <span className="text-caption-2 text-text-tertiary uppercase tracking-wider">Billed to</span>
      {hasDetails ? (
        <>
          {fullName && <span className="text-body-4-emphasis text-text-primary">{fullName}</span>}
          {streetLine && (
            <span className="text-caption-1 text-text-tertiary leading-relaxed">{streetLine}</span>
          )}
          {contactLine && (
            <span className="text-caption-1 text-text-tertiary leading-relaxed">{contactLine}</span>
          )}
        </>
      ) : (
        <span className="text-caption-1 text-text-tertiary">No billing contact on file.</span>
      )}
    </section>
  );
};

export default InvoiceBilledTo;
