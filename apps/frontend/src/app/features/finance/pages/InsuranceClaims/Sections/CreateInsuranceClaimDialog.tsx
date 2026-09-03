'use client';
import React from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useInsuranceClaimDraft } from '@/app/features/finance/pages/InsuranceClaims/Sections/useInsuranceClaimDraft';
import InsuranceClaimFormFields, {
  type CompanionChoice,
} from '@/app/features/finance/pages/InsuranceClaims/Sections/InsuranceClaimFormFields';
import type { CreateInsuranceClaimInput } from '@/app/features/finance/types/insuranceClaim';

export type { CompanionChoice };

type CreateInsuranceClaimDialogProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  companions: CompanionChoice[];
  currency: string;
  saving: boolean;
  error: string | null;
  onSubmit: (input: CreateInsuranceClaimInput) => void;
};

/**
 * The insurance-claim editor. A claim always starts as a DRAFT, so there is no
 * status control here - the claim is submitted and progressed from its detail
 * panel. Composition: the draft state and validation live in
 * `useInsuranceClaimDraft`, the fields in `InsuranceClaimFormFields`, and this
 * component owns only the modal shell, the save-time dismissal guard and the
 * error line.
 */
const CreateInsuranceClaimDialog = ({
  open,
  setOpen,
  companions,
  currency,
  saving,
  error,
  onSubmit,
}: CreateInsuranceClaimDialogProps) => {
  const { draft, setField, formError, submit } = useInsuranceClaimDraft();
  const message = formError ?? error;

  // A create request cannot be cancelled, so every dismissal route is closed
  // while saving - ModalBase also closes on Escape and an outside click, and
  // neither consults the disabled Cancel button.
  const setOpenUnlessSaving: React.Dispatch<React.SetStateAction<boolean>> = (value) => {
    if (saving) return;
    setOpen(value);
  };

  return (
    <CenterModal
      showModal={open}
      setShowModal={setOpenUnlessSaving}
      ariaLabel="Create an insurance claim"
      containerClassName="sm:w-[min(640px,92vw)]! max-h-[90vh] overflow-y-auto"
    >
      <div className="flex flex-col gap-4 p-6!">
        <h2 className="text-heading-4 text-text-primary">New insurance claim</h2>

        <InsuranceClaimFormFields
          draft={draft}
          setField={setField}
          currency={currency}
          companions={companions}
        />

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
            ariaLabel="Cancel creating this claim"
          />
          <Primary
            text={saving ? 'Creating...' : 'Create claim'}
            isDisabled={saving}
            onClick={() => submit(currency, onSubmit)}
            ariaLabel="Create this insurance claim"
          />
        </div>
      </div>
    </CenterModal>
  );
};

export default CreateInsuranceClaimDialog;
