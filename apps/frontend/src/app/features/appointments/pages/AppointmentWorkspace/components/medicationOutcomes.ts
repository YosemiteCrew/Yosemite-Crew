import {
  administerMedication,
  holdMedication,
  missMedication,
  refuseMedication,
  type MedicationAdministrationEntry,
} from '@/app/features/appointments/services/medicationAdministrationService';
import type { ButtonVariant } from '@/app/ui/Button';

export type MedicationOutcomeAction = (
  organisationId: string,
  entryId: string
) => Promise<MedicationAdministrationEntry>;

export type MedicationOutcome = {
  /** Button copy, and the accessible name the row's action is found by. */
  label: string;
  variant: ButtonVariant;
  action: MedicationOutcomeAction;
};

/**
 * The outcomes a nurse can record against a scheduled dose.
 *
 * One table rather than four hand-written buttons: the row renders every entry
 * identically and the panel hands the chosen action straight to the service, so
 * adding an outcome cannot leave one row's wiring behind the others.
 */
export const MEDICATION_OUTCOMES: MedicationOutcome[] = [
  { label: 'Record given', variant: 'primary', action: administerMedication },
  { label: 'Hold', variant: 'secondary', action: holdMedication },
  { label: 'Mark missed', variant: 'secondary', action: missMedication },
  { label: 'Record refused', variant: 'secondary', action: refuseMedication },
];
