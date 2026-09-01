'use client';
import React from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useEstimateDraft } from '@/app/features/finance/pages/Estimates/Sections/useEstimateDraft';
import {
  EstimateHeaderFields,
  EstimateLineEditor,
  EstimateNotesField,
  EstimateTotalsPanel,
  type CompanionChoice,
} from '@/app/features/finance/pages/Estimates/Sections/EstimateDraftFields';
import type { CreateEstimateInput } from '@/app/features/finance/types/estimate';

export type { CompanionChoice };

type CreateEstimateDialogProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  companions: CompanionChoice[];
  currency: string;
  saving: boolean;
  error: string | null;
  onSubmit: (input: CreateEstimateInput) => void;
};

/**
 * The estimate editor.
 *
 * State and the payload live in `useEstimateDraft`; the form is assembled from
 * the sections in `EstimateDraftFields`. Totals mirror the backend's
 * `computeTotals` exactly, so the figure previewed here is the figure saved,
 * and validation mirrors the controller's zod schema so the user learns what is
 * wrong before a request goes out.
 */
const CreateEstimateDialog = ({
  open,
  setOpen,
  companions,
  currency,
  saving,
  error,
  onSubmit,
}: CreateEstimateDialogProps) => {
  const draft = useEstimateDraft();
  const message = draft.formError ?? error;

  /**
   * ModalBase also closes on Escape and on an outside click, and those paths do
   * not consult the disabled Cancel button. A create request cannot be
   * cancelled, so dismissing mid-flight can let one succeed invisibly and a
   * retry mint a second estimate. Swallowing the state change while saving
   * closes every route out.
   */
  const setOpenUnlessSaving: React.Dispatch<React.SetStateAction<boolean>> = (value) => {
    if (saving) return;
    setOpen(value);
  };

  return (
    <CenterModal
      showModal={open}
      setShowModal={setOpenUnlessSaving}
      ariaLabel="Create an estimate"
      // Capped and scrollable: the user can add unlimited lines, and the dialog
      // locks body scroll, so an unbounded height puts the totals and the
      // submit button off-screen with no way to reach them.
      containerClassName="sm:w-[min(780px,92vw)]! max-h-[90vh] overflow-y-auto"
    >
      <div className="flex flex-col gap-4 p-6!">
        <h2 className="text-heading-4 text-text-primary">New estimate</h2>

        <EstimateHeaderFields
          companions={companions}
          patientId={draft.patientId}
          setPatientId={draft.setPatientId}
          validUntil={draft.validUntil}
          setValidUntil={draft.setValidUntil}
        />

        <EstimateLineEditor
          lines={draft.lines}
          currency={currency}
          updateLine={draft.updateLine}
          removeLine={draft.removeLine}
          addLine={draft.addLine}
        />

        <EstimateNotesField notes={draft.notes} setNotes={draft.setNotes} />

        <EstimateTotalsPanel totals={draft.totals} currency={currency} />

        {message ? (
          <p role="alert" className="text-body-4 text-text-error">
            {message}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Secondary
            text="Cancel"
            isDisabled={saving}
            onClick={() => setOpenUnlessSaving(false)}
            ariaLabel="Cancel creating this estimate"
          />
          <Primary
            text={saving ? 'Creating...' : 'Create estimate'}
            isDisabled={saving}
            onClick={() => draft.submit(onSubmit)}
            ariaLabel="Create this estimate"
          />
        </div>
      </div>
    </CenterModal>
  );
};

export default CreateEstimateDialog;
