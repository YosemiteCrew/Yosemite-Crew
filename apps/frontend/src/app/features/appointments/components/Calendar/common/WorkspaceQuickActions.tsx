import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { allowReschedule, canAssignAppointmentRoom } from '@/app/lib/appointments';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import {
  IoCalendarOutline,
  IoDocumentTextOutline,
  IoCardOutline,
  IoFlaskOutline,
} from 'react-icons/io5';
import { MdMeetingRoom } from 'react-icons/md';
import { RiHistoryLine } from 'react-icons/ri';

type WorkspaceQuickActionsProps = {
  appointment: Appointment;
  canEditAppointments: boolean;
  clinicalNotesLabel: string;
  onActionBarWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
  onOpenCompanionHistory: () => void;
  onOpenWorkspace: (intent?: AppointmentViewIntent) => void;
  onReschedule: () => void;
  onChangeRoom?: () => void;
};

const WorkspaceQuickActions = ({
  appointment,
  canEditAppointments,
  clinicalNotesLabel,
  onActionBarWheel,
  onOpenCompanionHistory,
  onOpenWorkspace,
  onReschedule,
  onChangeRoom,
}: WorkspaceQuickActionsProps) => (
  <div
    className="scrollbar-hidden flex w-48 shrink-0 items-center gap-2 overflow-x-auto pr-1"
    onWheel={onActionBarWheel}
  >
    <GlassTooltip content="Overview" side="top">
      <button
        type="button"
        title="Appointment overview"
        aria-label="Appointment overview"
        className="flex size-12 shrink-0 items-center justify-center rounded-full! border border-neutral-200 p-3 text-neutral-800 hover:bg-card-bg"
        onClick={onOpenCompanionHistory}
      >
        <RiHistoryLine size={20} aria-hidden="true" />
      </button>
    </GlassTooltip>
    <GlassTooltip content="Finance summary" side="top">
      <button
        type="button"
        title="Finance summary"
        aria-label="Finance summary"
        className="flex size-12 shrink-0 items-center justify-center rounded-full! border border-neutral-200 p-3 text-neutral-800 hover:bg-card-bg"
        onClick={() => onOpenWorkspace({ label: 'finance', subLabel: 'summary' })}
      >
        <IoCardOutline size={20} aria-hidden="true" />
      </button>
    </GlassTooltip>
    <GlassTooltip content="Lab tests" side="top">
      <button
        type="button"
        title="Lab tests"
        aria-label="Lab tests"
        className="flex size-12 shrink-0 items-center justify-center rounded-full! border border-neutral-200 p-3 text-neutral-800 hover:bg-card-bg"
        onClick={() => onOpenWorkspace({ label: 'labs', subLabel: 'idexx-labs' })}
      >
        <IoFlaskOutline size={20} aria-hidden="true" />
      </button>
    </GlassTooltip>
    {canEditAppointments && allowReschedule(appointment.status) && (
      <GlassTooltip content="Reschedule" side="top">
        <button
          type="button"
          title="Reschedule"
          aria-label="Reschedule appointment"
          className="flex size-12 shrink-0 items-center justify-center rounded-full! border border-neutral-200 p-3 text-neutral-800 hover:bg-card-bg"
          onClick={onReschedule}
        >
          <IoCalendarOutline size={20} aria-hidden="true" />
        </button>
      </GlassTooltip>
    )}
    {canEditAppointments && canAssignAppointmentRoom(appointment.status) && (
      <GlassTooltip content="Assign room" side="top">
        <button
          type="button"
          title="Assign room"
          aria-label="Assign room"
          className="flex size-12 shrink-0 items-center justify-center rounded-full! border border-neutral-200 p-3 text-neutral-800 hover:bg-card-bg"
          onClick={onChangeRoom}
        >
          <MdMeetingRoom size={20} aria-hidden="true" />
        </button>
      </GlassTooltip>
    )}
    <GlassTooltip content={clinicalNotesLabel} side="top">
      <button
        type="button"
        title={clinicalNotesLabel}
        aria-label={clinicalNotesLabel}
        className="flex size-12 shrink-0 items-center justify-center rounded-full! border border-neutral-200 p-3 text-neutral-800 hover:bg-card-bg"
        onClick={() => onOpenWorkspace()}
      >
        <IoDocumentTextOutline size={20} aria-hidden="true" />
      </button>
    </GlassTooltip>
  </div>
);

export default WorkspaceQuickActions;
