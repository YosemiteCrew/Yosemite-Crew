import React from 'react';
import { IoArrowForward, IoBedOutline, IoFootstepsOutline } from 'react-icons/io5';
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
 * Editable Room/Unit dropdown wrapped in the same floating-label box shell as the
 * sibling fields (StaffField / ConsultationTypeField / ReadOnlyMetaField). The
 * shared LabelDropdown renders a block label above a 42px/rounded-xl trigger,
 * which sat ~21px lower than the peers and read as detached (#1905). We can't
 * change the shared component here, so the wrapper restyles its trigger
 * (`[&>div>div>button]`) to the meta box (min-h-12, rounded-2xl, --whitebg, pl-5)
 * and repositions its own single label span (`[&>div>span]`) to float on the top
 * border like ReadOnlyMetaField, so the locked and unlocked states share one 48px
 * baseline with the value sitting inside the box. (Repositioning the existing
 * label — rather than hiding it and adding a second caption — keeps exactly one
 * label node.)
 */
const EditableMetaDropdown = ({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: DropdownItem[];
  value?: string;
  onSelect: (option: DropdownOption) => void;
}) => (
  <div className="relative w-full [&>div>div>button]:min-h-12 [&>div>div>button]:rounded-2xl! [&>div>div>button]:bg-(--whitebg)! [&>div>div>button]:pl-5! [&>div>span]:pointer-events-none [&>div>span]:absolute [&>div>span]:-top-2 [&>div>span]:left-5 [&>div>span]:z-10 [&>div>span]:mb-0 [&>div>span]:bg-(--whitebg) [&>div>span]:px-1 [&>div>span]:text-caption-2 [&>div>span]:font-normal [&>div>span]:text-text-secondary">
    <LabelDropdown
      placeholder={label}
      options={options}
      defaultOption={value}
      onSelect={onSelect}
    />
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
          {isInpatient ? <IoBedOutline size={16} /> : <IoFootstepsOutline size={16} />}
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
        <StaffField label="Assigned lead" name={encounter.leadName} photoUrl={leadPhotoUrl} />
      </div>
      <div className="w-52">
        <StaffField label="Support staff" name={encounter.nurseName} photoUrl={supportPhotoUrl} />
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
            <EditableMetaDropdown
              label="Room"
              options={roomOptions}
              value={encounter.roomId}
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
            <EditableMetaDropdown
              label="Unit"
              options={unitOptions}
              value={encounter.unitId}
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
        label="Ready for billing"
        state={encounter.readyForBilling}
        disabled={billingTogglesLocked}
        onToggle={onToggleReadyForBilling}
      />
      <ReadyToggle
        label="Ready for discharge"
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
