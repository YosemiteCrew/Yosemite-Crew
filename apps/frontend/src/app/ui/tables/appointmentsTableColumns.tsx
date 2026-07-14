import React from 'react';
import Image from 'next/image';
import { FaCheckCircle } from 'react-icons/fa';
import { IoIosCloseCircle, IoIosCalendar } from 'react-icons/io';
import { IoEyeOutline, IoCardOutline, IoDocumentTextOutline } from 'react-icons/io5';
import { MdMeetingRoom, MdOutlineAutorenew, MdScience } from 'react-icons/md';
import { RiHistoryLine } from 'react-icons/ri';
import { Appointment } from '@yosemite-crew/types';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';
import { toTitle } from '@/app/lib/validators';
import {
  allowCalendarDrag,
  canAssignAppointmentRoom,
  canShowStatusChangeAction,
  getAppointmentCompanionPhotoUrl,
  getClinicalNotesLabel,
  isRequestedLikeStatus,
} from '@/app/lib/appointments';
import { getStatusStyle } from '@/app/config/statusConfig';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { getAppointmentPaymentDisplay } from '@/app/lib/paymentStatus';
import type { Invoice, Organisation, RoomUnit } from '@yosemite-crew/types';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { formatCompanionNameWithOwnerLastName, getOwnerFirstName } from '@/app/lib/companionName';
import { AppointmentModePill } from '@/app/features/appointments/components/AppointmentCardContent';
import { getAppointmentRoomDisplay } from '@/app/lib/appointmentRoomDisplay';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';

export const normalizeLeadId = (value?: string | null): string => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  const lowered = trimmed.toLowerCase();
  return lowered === 'undefined' || lowered === 'null' ? '' : trimmed;
};

export type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type BuildAppointmentColumnsArgs = {
  encountersById: Record<string, AppointmentEncounter>;
  roomUnitsById: Record<string, RoomUnit>;
  leadNameByPractitionerId: Map<string, string>;
  orgsById: Record<string, Organisation>;
  invoicesByAppointmentId: Record<string, Invoice>;
  canEditAppointments: boolean;
  getSoapViewIntent: (appointment: Appointment) => AppointmentViewIntent;
  onViewAppointmentHistory: (appointment: Appointment) => void;
  onViewAppointment: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
  onChangeStatusAppointment: (appointment: Appointment) => void;
  onCancelAppointment: (appointment: Appointment) => void;
  onRescheduleAppointment: (appointment: Appointment) => void;
  onChangeRoomAppointment: (appointment: Appointment) => void;
  onWorkspaceAppointment: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
};

export const buildAppointmentColumns = ({
  encountersById,
  roomUnitsById,
  leadNameByPractitionerId,
  orgsById,
  invoicesByAppointmentId,
  canEditAppointments,
  getSoapViewIntent,
  onViewAppointmentHistory,
  onViewAppointment,
  onChangeStatusAppointment,
  onCancelAppointment,
  onRescheduleAppointment,
  onChangeRoomAppointment,
  onWorkspaceAppointment,
}: BuildAppointmentColumnsArgs): Column<Appointment>[] => [
  {
    label: '',
    key: 'logo',
    width: '56px',
    render: (item: Appointment) => (
      <div className="appointment-profile size-10">
        {(() => {
          const companion = item.companion ?? item.patient;
          return (
            <Image
              src={getSafeImageUrl(
                getAppointmentCompanionPhotoUrl(companion),
                companion.species as ImageType
              )}
              alt=""
              height={40}
              width={40}
              className="size-10 rounded-full object-cover"
            />
          );
        })()}
      </div>
    ),
  },
  {
    label: 'Name',
    key: 'name',
    width: '140px',
    render: (item: Appointment) => (
      <div className="appointment-profile">
        <div className="appointment-profile-two">
          <button
            type="button"
            onClick={() => onViewAppointmentHistory(item)}
            className="appointment-profile-title cursor-pointer hover:underline underline-offset-2 text-left"
            title="Open appointment overview"
          >
            {formatCompanionNameWithOwnerLastName(item?.companion?.name, item?.companion?.parent)}
          </button>
          <div className="appointment-profile-sub">
            {getOwnerFirstName(item?.companion?.parent) || ''}
          </div>
        </div>
      </div>
    ),
  },
  {
    label: 'Reason',
    key: 'reason',
    width: '120px',
    render: (item: Appointment) => (
      <div className="appointment-profile-two">
        <div className="appointment-profile-title">{item.concern || '-'}</div>
        {item.isEmergency && <div className="appointment-emergency-label">Emergency</div>}
      </div>
    ),
  },
  {
    label: 'Service',
    key: 'service',
    width: '110px',
    render: (item: Appointment) => (
      <div className="appointment-profile-title">{item.appointmentType?.name || '-'}</div>
    ),
  },
  {
    label: 'Room',
    key: 'room',
    width: '130px',
    render: (item: Appointment) => {
      const roomDisplay = getAppointmentRoomDisplay(item, encountersById, roomUnitsById);
      return (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">{roomDisplay.roomName}</div>
          {roomDisplay.unitLabel && (
            <div className="appointment-profile-sub text-[12px]">{roomDisplay.unitLabel}</div>
          )}
          <AppointmentModePill
            appointment={item}
            className="mt-1 h-6 w-fit px-2.5 text-[10px]"
            iconSize={12}
            tone="strong"
          />
        </div>
      );
    },
  },
  {
    label: 'Date/Time',
    key: 'date/time',
    width: '110px',
    render: (item: Appointment) => (
      <div className="appointment-profile-two">
        <div className="appointment-profile-sub">{formatDateLabel(item.appointmentDate)}</div>
        <div className="appointment-profile-title">{formatTimeLabel(item.startTime)}</div>
      </div>
    ),
  },
  {
    label: 'Lead',
    key: 'lead',
    width: '120px',
    render: (item: Appointment) => {
      const leadId = normalizeLeadId(item.lead?.id);
      const leadName =
        item.lead?.name?.trim() ||
        (leadId ? leadNameByPractitionerId.get(leadId) : undefined) ||
        '-';
      return (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">{leadName}</div>
        </div>
      );
    },
  },
  {
    label: 'Support',
    key: 'support',
    width: '110px',
    render: (item: Appointment) => {
      const supportStaff = item.supportStaff ?? [];

      return (
        <div className="appointment-profile-two">
          {supportStaff.length > 0 ? (
            supportStaff.map((sup) => (
              <div key={sup.id} className="appointment-profile-sub">
                {sup.name}
              </div>
            ))
          ) : (
            <div className="appointment-profile-sub">-</div>
          )}
        </div>
      );
    },
  },
  {
    label: 'Status',
    key: 'status',
    width: '130px',
    render: (item: Appointment) => {
      const displayStatus = item.status === 'REQUESTED' ? 'REQUESTED' : item.status;
      const payment = getAppointmentPaymentDisplay(item, invoicesByAppointmentId);
      const statusStyle = getStatusStyle(displayStatus);

      return (
        <div className="appointment-profile-two">
          <div
            className="appointment-status"
            style={{
              ...statusStyle,
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
          >
            {toTitle(displayStatus)}
          </div>
          <div
            className="mt-1 text-[11px] leading-4 font-medium text-center font-satoshi"
            style={{ color: payment.textColor }}
          >
            {payment.label}
          </div>
        </div>
      );
    },
  },
  {
    label: 'Actions',
    key: 'actions',
    width: '210px',
    render: (item: Appointment) => {
      const orgType = (item.organisationId && orgsById[item.organisationId]?.type) || 'HOSPITAL';
      const clinicalNotesLabel = getClinicalNotesLabel(orgType);
      const companionName = (item.companion ?? item.patient).name || 'appointment';

      if (isRequestedLikeStatus(item.status)) {
        return (
          <div className="action-btn-col">
            <div className="action-btn-grid action-btn-grid-capped">
              <GlassTooltip content="Accept request" side="bottom" className="table-action-tooltip">
                <button
                  type="button"
                  className="action-btn"
                  style={{ background: 'var(--color-success-100)' }}
                  onClick={() => onChangeStatusAppointment(item)}
                  aria-label={`Accept request for ${companionName}`}
                >
                  <FaCheckCircle size={22} color="var(--color-success-400)" />
                </button>
              </GlassTooltip>
              <GlassTooltip
                content="Decline request"
                side="bottom"
                className="table-action-tooltip"
              >
                <button
                  type="button"
                  onClick={() => onCancelAppointment(item)}
                  aria-label={`Decline request for ${companionName}`}
                  className="action-btn"
                  style={{ background: 'var(--color-danger-100)' }}
                >
                  <IoIosCloseCircle size={24} color="var(--color-danger-600)" />
                </button>
              </GlassTooltip>
            </div>
          </div>
        );
      }

      return (
        <div className="action-btn-col">
          <div className="action-btn-grid action-btn-grid-capped">
            <GlassTooltip content="View appointment" side="bottom" className="table-action-tooltip">
              <button
                type="button"
                onClick={() => onViewAppointment(item)}
                aria-label={`View appointment for ${companionName}`}
                className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
              >
                <IoEyeOutline size={20} color="var(--color-neutral-900)" />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Overview" side="bottom" className="table-action-tooltip">
              <button
                type="button"
                onClick={() => onViewAppointmentHistory(item)}
                aria-label={`View overview for ${companionName}`}
                className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                title="Appointment overview"
              >
                <RiHistoryLine size={18} color="var(--color-neutral-900)" />
              </button>
            </GlassTooltip>
            {canEditAppointments && canShowStatusChangeAction(item.status) && (
              <GlassTooltip content="Change status" side="bottom" className="table-action-tooltip">
                <button
                  type="button"
                  onClick={() => onChangeStatusAppointment(item)}
                  aria-label={`Change status for ${companionName}`}
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                >
                  <MdOutlineAutorenew size={18} color="var(--color-neutral-900)" />
                </button>
              </GlassTooltip>
            )}
            {canEditAppointments && allowCalendarDrag(item.status as any) && (
              <GlassTooltip content="Reschedule" side="bottom" className="table-action-tooltip">
                <button
                  type="button"
                  onClick={() => onRescheduleAppointment(item)}
                  aria-label={`Reschedule appointment for ${companionName}`}
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                >
                  <IoIosCalendar size={18} color="var(--color-neutral-900)" />
                </button>
              </GlassTooltip>
            )}
            {canEditAppointments && canAssignAppointmentRoom(item.status) && (
              <GlassTooltip content="Assign room" side="bottom" className="table-action-tooltip">
                <button
                  type="button"
                  onClick={() => onChangeRoomAppointment(item)}
                  aria-label={`Assign room for ${companionName}`}
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                >
                  <MdMeetingRoom size={18} color="var(--color-neutral-900)" />
                </button>
              </GlassTooltip>
            )}
            <GlassTooltip
              content={clinicalNotesLabel}
              side="bottom"
              className="table-action-tooltip"
            >
              <button
                type="button"
                onClick={() => onWorkspaceAppointment(item, getSoapViewIntent(item))}
                aria-label={`${clinicalNotesLabel} for ${companionName}`}
                className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                title={clinicalNotesLabel}
              >
                <IoDocumentTextOutline size={18} color="var(--color-neutral-900)" />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Finance summary" side="bottom" className="table-action-tooltip">
              <button
                type="button"
                onClick={() =>
                  onWorkspaceAppointment(item, {
                    label: 'finance',
                    subLabel: 'summary',
                  })
                }
                aria-label={`Finance summary for ${companionName}`}
                className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
              >
                <IoCardOutline size={18} color="var(--color-neutral-900)" />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Lab tests" side="bottom" className="table-action-tooltip">
              <button
                type="button"
                onClick={() =>
                  onWorkspaceAppointment(item, {
                    label: 'labs',
                    subLabel: 'idexx-labs',
                  })
                }
                aria-label={`Lab tests for ${companionName}`}
                className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
              >
                <MdScience size={18} color="var(--color-neutral-900)" />
              </button>
            </GlassTooltip>
          </div>
        </div>
      );
    },
  },
];
