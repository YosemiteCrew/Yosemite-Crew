import React from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import Datepicker from '@/app/ui/inputs/Datepicker';
import Timepicker from '@/app/ui/inputs/Timepicker';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { type AppointmentEncounter } from '@/app/features/appointments/types/workspace';

type DischargeDateTimeModalProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  dischargeDate: Date | null;
  setDischargeDate: React.Dispatch<React.SetStateAction<Date | null>>;
  dischargeTime: string;
  setDischargeTime: (next: string) => void;
  onConfirm: () => void;
  isSaving: boolean;
  /** Backend-owned discharge readiness; when disabled, an override reason is required. */
  gate?: NonNullable<AppointmentEncounter['finalizationGate']>;
  overrideReason: string;
  setOverrideReason: (next: string) => void;
};

/**
 * Exported rather than kept private to this module so Storybook can draw it on
 * its own. Reaching it through the workspace needs the whole bootstrap
 * aggregate - an appointment, an inpatient encounter, a room unit and a
 * backend-owned finalization gate - so the gate-blocked branch below had never
 * been rendered anywhere outside the running app.
 */
export const DischargeDateTimeModal = ({
  showModal,
  setShowModal,
  dischargeDate,
  setDischargeDate,
  dischargeTime,
  setDischargeTime,
  onConfirm,
  isSaving,
  gate,
  overrideReason,
  setOverrideReason,
}: DischargeDateTimeModalProps) => {
  const handleCancel = () => {
    if (isSaving) return;
    setShowModal(false);
  };

  // When the backend gate blocks discharge, the clinician must give an override
  // reason before confirming — this is the audited, exceptional discharge path.
  const gateBlocked = gate ? gate.enabled === false : false;
  const overrideMissing = gateBlocked && !overrideReason.trim();
  const confirmLabel = (() => {
    if (isSaving) return 'Discharging...';
    return gateBlocked ? 'Override & discharge' : 'Confirm discharge';
  })();

  return (
    <CenterModal showModal={showModal} setShowModal={setShowModal} onClose={handleCancel}>
      <div className="flex w-full flex-col gap-4">
        <ModalHeader title="Discharge date & time" onClose={handleCancel} />
        {gateBlocked && (
          <div className="flex flex-col gap-2 rounded-2xl bg-danger-100 p-3">
            <p className="text-body-4 text-text-error">
              {gate?.disabledReason ?? 'This encounter is not ready for discharge.'}
            </p>
            <label className="flex flex-col gap-1 text-caption-2 text-text-secondary">
              {'Override reason (required)'}
              <textarea
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                rows={2}
                className="rounded-xl border border-input-border-default px-3 py-2 text-body-4 text-text-primary"
                placeholder="Explain why discharge proceeds despite the open requirements"
              />
            </label>
          </div>
        )}
        <div className={`${isSaving ? 'pointer-events-none' : ''} flex flex-col gap-3`}>
          <Datepicker
            type="input"
            currentDate={dischargeDate}
            setCurrentDate={setDischargeDate}
            placeholder="Discharge date"
          />
          <Timepicker value={dischargeTime} onChange={setDischargeTime} label="Discharge time" />
        </div>
        <div className="flex w-full flex-wrap items-center justify-center gap-2 pb-3">
          <Secondary
            href="#"
            text="Cancel"
            onClick={handleCancel}
            isDisabled={isSaving}
            className="w-auto min-w-30"
          />
          <Primary
            href="#"
            text={confirmLabel}
            onClick={onConfirm}
            isDisabled={isSaving || overrideMissing}
            className="w-auto min-w-36"
          />
        </div>
      </div>
    </CenterModal>
  );
};
