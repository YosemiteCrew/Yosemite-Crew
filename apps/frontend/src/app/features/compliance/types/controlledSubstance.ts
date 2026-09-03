import type { StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';

/**
 * Types for the DEA controlled-substance register. Mirrors the backend
 * `ControlledSubstanceLog` model and the `DeaSchedule` / `DrugUnit` enums
 * (packages/database/prisma/schema.prisma). Dates arrive as ISO strings over
 * JSON, so `loggedAt`, `createdAt` and `updatedAt` are typed as `string`.
 */
export type DeaSchedule = 'II' | 'III' | 'IV' | 'V';

export type DrugUnit = 'ML' | 'MG' | 'MCG' | 'TABLET' | 'CAPSULE' | 'PATCH' | 'UNIT';

export interface ControlledSubstanceLog {
  id: string;
  organisationId: string;
  patientId: string | null;
  encounterId: string | null;
  loggedAt: string;
  drug: string;
  deaSchedule: DeaSchedule;
  lotNumber: string | null;
  strength: number | null;
  unit: DrugUnit;
  amountDrawn: number;
  amountAdministered: number;
  amountWasted: number;
  wastedWitness: string | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  administeredBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The create payload the register sends. `administeredBy` is intentionally
 * absent: the backend stamps it from the authenticated user, never from the
 * request body (controlled-substance-log.controller.ts).
 */
export interface CreateControlledSubstanceLogInput {
  loggedAt: string;
  drug: string;
  deaSchedule: DeaSchedule;
  unit: DrugUnit;
  amountDrawn: number;
  amountAdministered: number;
  amountWasted?: number;
  wastedWitness?: string;
  strength?: number;
  lotNumber?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  patientId?: string;
  encounterId?: string;
  notes?: string;
}

/**
 * List filters the API supports. `drug` is a case-insensitive contains match,
 * the schedule is exact, and `fromDate`/`toDate` bound `loggedAt` (all ISO
 * datetimes).
 */
export interface ControlledSubstanceLogFilters {
  drug?: string;
  deaSchedule?: DeaSchedule;
  fromDate?: string;
  toDate?: string;
  patientId?: string;
}

export const DEA_SCHEDULES: readonly DeaSchedule[] = ['II', 'III', 'IV', 'V'];

export const DRUG_UNITS: readonly DrugUnit[] = [
  'ML',
  'MG',
  'MCG',
  'TABLET',
  'CAPSULE',
  'PATCH',
  'UNIT',
];

export const DEA_SCHEDULE_LABEL: Record<DeaSchedule, string> = {
  II: 'Schedule II',
  III: 'Schedule III',
  IV: 'Schedule IV',
  V: 'Schedule V',
};

/**
 * Hotter tone for the tighter schedule: C-II is the most restricted, C-V the
 * least. The pill is read at a glance by a controller reconciling the ledger.
 */
export const DEA_SCHEDULE_TONE: Record<DeaSchedule, StatusTone> = {
  II: 'danger',
  III: 'warning',
  IV: 'info',
  V: 'neutral',
};

export const DRUG_UNIT_LABEL: Record<DrugUnit, string> = {
  ML: 'mL',
  MG: 'mg',
  MCG: 'mcg',
  TABLET: 'tablet',
  CAPSULE: 'capsule',
  PATCH: 'patch',
  UNIT: 'unit',
};

/**
 * Exact amount rendering. A controlled-drug ledger reconciles to the last
 * decimal, so we render the number's own shortest round-trip string rather than
 * a fixed-precision format that could silently drop 0.05 mL. `null` balances
 * render as an em dash.
 */
export const formatAmount = (value: number | null | undefined): string =>
  value === null || value === undefined || Number.isNaN(value) ? '—' : String(value);
