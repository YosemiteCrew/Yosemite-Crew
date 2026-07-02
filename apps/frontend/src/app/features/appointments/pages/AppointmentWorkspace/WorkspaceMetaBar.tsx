import React from 'react';
import { IoArrowForward } from 'react-icons/io5';
import { LuBedSingle, LuFootprints } from 'react-icons/lu';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary } from '@/app/ui/primitives/Buttons';
import ReadyToggle from '@/app/features/appointments/pages/AppointmentWorkspace/components/ReadyToggle';
import StaffField from '@/app/features/appointments/pages/AppointmentWorkspace/components/StaffField';
import {
  WORKSPACE_STEP_LABELS,
  type AppointmentEncounter,
  type EncounterMode,
  type WorkspaceStep,
} from '@/app/features/appointments/types/workspace';
import { getNextStep } from '@/app/lib/appointmentWorkspace';
import type { DropdownOption } from '@/app/hooks/useDropdown';

type DropdownItem = { label: string; value: string };

const getSelectedDropdownLabel = (
  options: DropdownItem[],
  selectedValue: string | undefined,
  fallback = '-'
) => options.find((option) => option.value === selectedValue)?.label ?? selectedValue ?? fallback;

const ReadOnlyMetaField = ({ label, value }: { label: string; value: string }) => (
  <div className="relative w-full">
    <div className="relative flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border border-input-border-default bg-(--whitebg) py-2 pr-5 pl-5">
      <span className="min-w-0 flex-1 truncate text-left text-body-4 text-text-primary">
        {value}
      </span>
    </div>
    <span className="pointer-events-none absolute -top-2 left-5 z-10 bg-(--whitebg) px-1 text-caption-2 text-text-secondary">
      {label}
    </span>
  </div>
);

/**
 * Read-only consultation-type field. Mirrors the StaffField floating-label box
 * but shows a mode-specific icon (bed = inpatient, footprints = outpatient)
 * instead of an avatar — the value is changed via the hospitalization flow.
 */
const ConsultationTypeField = ({ mode }: { mode: EncounterMode }) => {
  const isInpatient = mode === 'INPATIENT';
  const label = isInpatient ? 'Inpatient' : 'Outpatient';
  return (
    <div className="relative w-full">
      <div className="relative flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border border-input-border-default bg-(--whitebg) py-2 pr-2 pl-5">
        <span className="min-w-0 flex-1 truncate text-left text-body-4 text-text-primary">
          {label}
        </span>
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-text-brand"
        >
          {isInpatient ? <LuBedSingle size={16} /> : <LuFootprints size={16} />}
        </span>
      </div>
      <span className="pointer-events-none absolute -top-2 left-5 z-10 bg-(--whitebg) px-1 text-caption-2 text-text-secondary">
        Consultation type
      </span>
    </div>
  );
};

type WorkspaceMetaBarProps = {
  encounter: AppointmentEncounter;
  activeStep: WorkspaceStep;
  leadPhotoUrl?: string;
  supportPhotoUrl?: string;
  roomOptions: DropdownItem[];
  unitOptions: DropdownItem[];
  onSelectRoom: (option: DropdownOption) => void;
  onSelectUnit: (option: DropdownOption) => void;
  onSaveAndNext: () => void;
  onToggleReadyForBilling: () => void;
  onToggleReadyForDischarge: () => void;
  roomAssignmentLocked?: boolean;
  /**
   * Lock for the billing readiness toggle. Billing is operational, so it is NOT
   * frozen by the clinical time-window — only by a persisted view-only encounter.
   */
  billingTogglesLocked: boolean;
  /**
   * Lock for the discharge readiness toggle. Discharge is clinical, so the
   * time-window applies. The checkbox itself stays interactive even though it
   * makes the step content read-only, so a mistaken check can be undone.
   */
  dischargeTogglesLocked: boolean;
  /** Step-specific primary action shown beside the Ready toggles. */
  primaryCta?: {
    label: string;
    onClick: () => void;
    isDisabled?: boolean;
    icon?: React.ReactNode;
  };
};

const WorkspaceMetaBar = ({
  encounter,
  activeStep,
  leadPhotoUrl,
  supportPhotoUrl,
  roomOptions,
  unitOptions,
  onSelectRoom,
  onSelectUnit,
  onSaveAndNext,
  onToggleReadyForBilling,
  onToggleReadyForDischarge,
  roomAssignmentLocked = false,
  billingTogglesLocked,
  dischargeTogglesLocked,
  primaryCta,
}: WorkspaceMetaBarProps) => {
  const isInpatient = encounter.mode === 'INPATIENT';
  // Room is shown for inpatient always, and for outpatient when the encounter
  // has a room assigned (a selected room id or room options to choose from).
  const showRoom = isInpatient || Boolean(encounter.roomId) || roomOptions.length > 0;
  const nextStep = getNextStep(activeStep);
  const saveLabel = nextStep ? WORKSPACE_STEP_LABELS[nextStep] : '';
  const locked = encounter.viewOnly;

  const staffFields = (
    <>
      <div className="w-52">
        <StaffField label="Assigned Lead" name={encounter.leadName} photoUrl={leadPhotoUrl} />
      </div>
      <div className="w-52">
        <StaffField label="Support Staff" name={encounter.nurseName} photoUrl={supportPhotoUrl} />
      </div>
      <div className="w-52">
        <ConsultationTypeField mode={encounter.mode} />
      </div>
      {/* Room shows whenever the encounter has one (outpatient or inpatient);
          Unit is inpatient-only. */}
      {showRoom && (
        <div className="w-40">
          {roomAssignmentLocked ? (
            <ReadOnlyMetaField
              label="Room"
              value={getSelectedDropdownLabel(roomOptions, encounter.roomId)}
            />
          ) : (
            <LabelDropdown
              placeholder="Room"
              options={roomOptions}
              defaultOption={encounter.roomId}
              onSelect={onSelectRoom}
            />
          )}
        </div>
      )}
      {isInpatient && (
        <div className="w-32">
          {roomAssignmentLocked ? (
            <ReadOnlyMetaField
              label="Unit"
              value={getSelectedDropdownLabel(unitOptions, encounter.unitId)}
            />
          ) : (
            <LabelDropdown
              placeholder="Unit"
              options={unitOptions}
              defaultOption={encounter.unitId}
              onSelect={onSelectUnit}
            />
          )}
        </div>
      )}
    </>
  );

  const readyToggles = (
    <>
      <ReadyToggle
        label="Ready for Billing"
        state={encounter.readyForBilling}
        disabled={billingTogglesLocked}
        onToggle={onToggleReadyForBilling}
      />
      <ReadyToggle
        label="Ready for Discharge"
        state={encounter.readyForDischarge}
        disabled={dischargeTogglesLocked}
        onToggle={onToggleReadyForDischarge}
      />
    </>
  );

  let saveButton: React.ReactNode = null;
  if (primaryCta) {
    saveButton = (
      <Primary
        text={primaryCta.label}
        onClick={primaryCta.onClick}
        icon={primaryCta.icon ?? <IoArrowForward />}
        iconPosition="right"
        isDisabled={primaryCta.isDisabled}
      />
    );
  } else if (nextStep) {
    saveButton = (
      <Primary
        text={saveLabel}
        onClick={onSaveAndNext}
        icon={<IoArrowForward />}
        iconPosition="right"
        isDisabled={locked}
      />
    );
  }

  // Two responsive columns. The left column holds the staff / consultation /
  // room / unit fields and lets them wrap across rows to use the available
  // width. The right column keeps the Ready toggles + Save button together
  // (toggles first, then the button), vertically centred with each other, and
  // wraps below the fields on narrow screens.
  return (
    <div className="flex flex-col gap-x-6 gap-y-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-5">{staffFields}</div>
      <div className="flex shrink-0 flex-wrap items-start gap-x-3 gap-y-5 lg:justify-end">
        {readyToggles}
        {saveButton}
      </div>
    </div>
  );
};

export default WorkspaceMetaBar;
