import type { AlertSummary, CompanionType, InsuranceDetails } from './companion';

// String-union mirror of the Prisma CompanionCardAudience enum (matching the
// codebase convention of string unions over TS enums). The audience drives the
// field-redaction policy enforced in the backend CompanionCardService.
export type CompanionCardAudience = 'PUBLIC' | 'OWNER' | 'REFERRAL_CLINIC' | 'STAFF';

// Insurance summary that, by construction, can never carry a policy number.
// The card surfaces insurance STATUS only; the full policy lives in the
// companion record. Typing the card's insurance block as this Pick makes it a
// compile-time guarantee that no audience projection can leak the policy number.
export type RedactedInsuranceSummary = Pick<InsuranceDetails, 'isInsured' | 'companyName'>;

export interface CompanionCardOwnerContact {
  firstName: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
}

export interface CompanionCardIdentity {
  id: string;
  name: string;
  type: CompanionType;
  breed: string;
  colour?: string;
  photoUrl?: string;
  microchipNumber?: string;
}

export interface CompanionCardMedical {
  allergy?: string;
  bloodGroup?: string;
  currentWeight?: number;
  isNeutered?: boolean;
}

export interface CompanionCardLatestVisit {
  status?: string;
  occurredAt?: string;
}

// Audience-scoped, already-redacted projection of a companion for the Companion
// Card. Assembled and redacted server-side in CompanionCardService; every block
// beyond identity is optional because an audience may omit it entirely (for
// example PUBLIC omits owner contact unless the issuer opted in).
export interface CompanionCardDTO {
  audience: CompanionCardAudience;
  identity: CompanionCardIdentity;
  passportNumber?: string;
  dateOfBirth?: string;
  alerts?: AlertSummary[];
  ownerContact?: CompanionCardOwnerContact;
  medical?: CompanionCardMedical;
  insurance?: RedactedInsuranceSummary;
  latestVisit?: CompanionCardLatestVisit;
}
