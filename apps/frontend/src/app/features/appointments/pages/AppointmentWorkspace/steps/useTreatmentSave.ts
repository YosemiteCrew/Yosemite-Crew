import { useState } from 'react';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type {
  AppointmentEncounter,
  PrescriptionItem,
} from '@/app/features/appointments/types/workspace';
import { savePrescriptionArtifact } from '@/app/features/appointments/services/workspaceClinicalService';
import { finalizePrescription } from '@/app/features/appointments/services/prescriptionWorkflowService';
import {
  getAppointmentWorkspaceBootstrap,
  normalizeWorkspaceBootstrapForEncounter,
  persistTreatmentItems,
} from '@/app/features/appointments/services/workspaceAggregateService';
import {
  DEFAULT_DURATION_UNIT,
  getPrescriptionSaveErrors,
} from '@/app/features/appointments/lib/inventoryPrescription';
import { getInvoiceErrorMessage } from './invoiceStepUtils';

// A save the backend rejects with 409 is NOT retryable: it refuses a plain save against an
// already-final prescription rather than silently reopening it to DRAFT and wiping its items.
// Every save sends status 'draft', so once the first save finalizes an in-house prescription
// each later save of that encounter conflicts — the generic "please try again" copy is actively
// misleading there, because retrying can only ever fail the same way.
// The server's own message ("Artifact is final. Reopen or amend it before editing.") is
// deliberately NOT surfaced verbatim: it names an internal concept ("artifact") this UI never
// shows, and directs the clinician to reopen/amend, which has no affordance on this screen —
// that would just trade one misleading message for another. The mapped copy mirrors the
// finalized/billed wording handleRemovePrescription already uses for the same 409.
const getTreatmentSaveErrorMessage = (error: unknown): string =>
  (error as { response?: { status?: number } })?.response?.status === 409
    ? 'This prescription is already finalized and can no longer be edited.'
    : getInvoiceErrorMessage(error, 'Unable to save treatment items. Please try again.');

/**
 * "Save treatment": validates the prescription rows, resolves an encounter to
 * persist against, writes the staged service/package and prescription rows,
 * finalizes the in-house prescriptions and re-hydrates from the server before
 * handing over to the invoice step.
 */
export const useTreatmentSave = ({
  appointmentId,
  organisationId,
  encounterId,
  authorId,
  encounter,
  prescriptionItems,
  setPrescriptionError,
  ensureEncounterId,
  onOpenInvoice,
}: {
  appointmentId: string;
  organisationId?: string;
  encounterId?: string;
  authorId?: string;
  encounter: AppointmentEncounter;
  /** Inventory-backfilled rows, which is what has to be persisted. */
  prescriptionItems: PrescriptionItem[];
  setPrescriptionError: (message: string | null) => void;
  ensureEncounterId?: () => Promise<string | undefined>;
  onOpenInvoice: () => void;
}) => {
  const setPrescriptions = useAppointmentWorkspaceStore((s) => s.setPrescriptions);
  const setStepStatus = useAppointmentWorkspaceStore((s) => s.setStepStatus);
  const mergeEncounterData = useAppointmentWorkspaceStore((s) => s.mergeEncounterData);
  const [treatmentSaveError, setTreatmentSaveError] = useState<string | null>(null);
  const [isSavingTreatment, setIsSavingTreatment] = useState(false);

  const handleSaveTreatment = async () => {
    if (isSavingTreatment) return;
    setTreatmentSaveError(null);
    // Normalize before validating/saving: the duration unit defaults to "days" (the value shown
    // on the card), so a row the clinician left at the default is complete and persists correctly.
    const normalizedPrescriptions = prescriptionItems.map((rx) => ({
      ...rx,
      durationUnit: rx.durationUnit?.trim() || DEFAULT_DURATION_UNIT,
    }));
    // Save-time validation gate: never advance with an incomplete prescription. This runs
    // BEFORE the persist/no-persist branch so it blocks even when org/encounter haven't hydrated
    // (otherwise the step would silently advance without validating). Each row must carry the
    // required clinical instructions (frequency, duration, quantity, route, form) and pass every
    // number-format rule. Finalized rows are read-only and skipped by the save loop, so exclude
    // them: an older/external finalized record missing a now-required field must not wedge the
    // save behind a validation error the clinician cannot fix.
    const prescriptionErrors = normalizedPrescriptions.flatMap((rx) =>
      rx.finalized ? [] : getPrescriptionSaveErrors(rx)
    );
    if (prescriptionErrors.length > 0) {
      setPrescriptionError(prescriptionErrors[0]);
      setTreatmentSaveError('Complete all prescription details before saving.');
      return;
    }
    setPrescriptionError(null);

    setIsSavingTreatment(true);
    // Every exit below clears the saving flag from the `finally`: a throw out of
    // the encounter resolve, the persist block or `onOpenInvoice` would
    // otherwise leave the button reading "Saving…" and disabled for good.
    try {
      // Resolve the encounter id, creating one (via check-in) when the appointment hasn't started —
      // an outpatient appointment has no encounter until then, so without this treatment/prescriptions
      // would only ever live locally and vanish on refresh.
      let activeEncounterId = encounterId;
      if (organisationId && !activeEncounterId && ensureEncounterId) {
        try {
          activeEncounterId = await ensureEncounterId();
        } catch (error) {
          console.error('Failed to resolve an encounter for treatment:', error);
        }
      }
      // Still no org/encounter (e.g. check-in unavailable) → keep the legacy local-only behaviour.
      if (!organisationId || !activeEncounterId) {
        setStepStatus(appointmentId, 'TREATMENT', 'COMPLETED');
        onOpenInvoice();
        return;
      }
      // Saved prescription ids captured from the create/update responses, so finalize targets the
      // real artifact id (not the local `local-rx-…` id) and the post-save bootstrap merge — not a
      // local append — becomes the single source of truth for the list (avoids duplicate rows).
      const savedInHouseIds: string[] = [];
      try {
        // Persist any staged service/package rows.
        await persistTreatmentItems(organisationId, activeEncounterId, encounter.services);
        // Persist prescription rows with their fully-entered clinical values (strength / route /
        // frequency / duration / quantity / refills). We save the inventory-BACKFILLED rows
        // (`prescriptionItems`), not the raw store rows, so inventory-owned fields the clinician
        // sees on the card (brand, strength unit, form, route, controlled flag, schedule) are
        // included in the payload even when the originally-hydrated record was missing them.
        // create-or-update is keyed off the row id.
        const reconciledPrescriptions = await Promise.all(
          normalizedPrescriptions.map(async (rx) => {
            // A finalized/billed prescription is a locked clinical record (its `finalized` flag is
            // only ever set from persisted server state, so it always carries a real id). Re-POSTing
            // it - or PATCHing it back to draft - returns 409 and fails the whole save, so leave the
            // already-persisted, already-dispensed row untouched instead of re-saving it.
            if (rx.finalized) {
              return rx;
            }
            const savedRx = await savePrescriptionArtifact(
              { organisationId, appointmentId, encounterId: activeEncounterId, authorId },
              rx
            );
            const savedId = (savedRx as { id?: string } | undefined)?.id ?? rx.id;
            if (savedId && rx.fulfillment !== 'PRESCRIPTION_ONLY') savedInHouseIds.push(savedId);
            return { ...rx, id: savedId };
          })
        );
        // Authoritatively replace the list with exactly the saved rows (deduped by backend id) so
        // there is never a stale local + persisted duplicate — even before the bootstrap lands or
        // when the bootstrap returns the still-draft prescription differently.
        const dedupedById = Array.from(
          new Map(reconciledPrescriptions.map((rx) => [rx.id, rx])).values()
        );
        setPrescriptions(appointmentId, dedupedById);
        // Finalize in-house prescriptions (triggers inventory dispense) using the real saved ids.
        await Promise.allSettled(
          savedInHouseIds.map((id) => finalizePrescription(organisationId, id))
        );
        // Re-hydrate from the authoritative server state — replaces the staged local rows so the
        // saved prescription appears exactly once.
        const bootstrap = await getAppointmentWorkspaceBootstrap(organisationId, appointmentId);
        mergeEncounterData(appointmentId, normalizeWorkspaceBootstrapForEncounter(bootstrap));
      } catch (error) {
        // Do NOT open Invoice when persistence fails — staged rows would otherwise
        // appear billable without a backing record.
        console.error('Failed to save treatment items:', error);
        setTreatmentSaveError(getTreatmentSaveErrorMessage(error));
        return;
      }
      setStepStatus(appointmentId, 'TREATMENT', 'COMPLETED');
      onOpenInvoice();
    } finally {
      setIsSavingTreatment(false);
    }
  };

  return { treatmentSaveError, isSavingTreatment, handleSaveTreatment };
};
