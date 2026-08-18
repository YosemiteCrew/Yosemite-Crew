import type { CompanionAlertSummary, CompanionCardDTO } from '@yosemite-crew/types';
import type { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import { storedAlertsToCompanionAlerts } from '@/app/features/appointments/lib/alertMapping';

const toIso = (value: Date | string | undefined | null): string | undefined => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const insuranceCompany = (insurance: unknown): string | undefined => {
  if (typeof insurance !== 'object' || insurance === null) return undefined;
  const company = (insurance as { companyName?: unknown }).companyName;
  return typeof company === 'string' ? company : undefined;
};

// The STAFF (full) card is read-only display of data the app already holds, so it
// is assembled client-side from the loaded companion record. The audience-redacted
// PUBLIC / REFERRAL projections, which an unauthenticated scanner can request, are
// produced server-side where redaction cannot be bypassed.
export const buildStaffCard = (record: CompanionParent): CompanionCardDTO => {
  const { companion, parent } = record;
  const alerts: CompanionAlertSummary[] = storedAlertsToCompanionAlerts(
    companion.alerts,
    'patient-alert'
  ).map((alert) => ({ title: alert.label, severity: alert.severity }));

  return {
    audience: 'STAFF',
    identity: {
      id: companion.id,
      name: companion.name,
      type: companion.type,
      breed: companion.breed,
      colour: companion.colour,
      photoUrl: companion.photoUrl,
      microchipNumber: companion.microchipNumber,
    },
    passportNumber: companion.passportNumber,
    dateOfBirth: toIso(companion.dateOfBirth),
    alerts: alerts.length > 0 ? alerts : undefined,
    medical: {
      allergy: companion.allergy,
      bloodGroup: companion.bloodGroup,
      currentWeight: companion.currentWeight,
      isNeutered: companion.isneutered,
    },
    insurance: {
      isInsured: companion.isInsured,
      companyName: insuranceCompany(companion.insurance),
    },
    ownerContact: {
      firstName: parent.firstName,
      lastName: parent.lastName ?? undefined,
      phoneNumber: parent.phoneNumber ?? undefined,
      email: parent.email,
    },
  };
};
