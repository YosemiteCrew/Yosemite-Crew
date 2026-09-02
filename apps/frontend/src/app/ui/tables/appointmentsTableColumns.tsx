import React from 'react';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import AvatarImage from '@/app/ui/avatars/AvatarImage';
import CompanionAvatar from '@/app/ui/avatars/CompanionAvatar';
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
import { getAppointmentStatusTone } from '@/app/config/statusConfig';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { getAppointmentPaymentDisplay } from '@/app/lib/paymentStatus';
import type { Invoice, Organisation, RoomUnit } from '@yosemite-crew/types';
import { formatCompanionNameWithOwnerLastName, getOwnerFirstName } from '@/app/lib/companionName';
import { AppointmentModePill } from '@/app/features/appointments/components/AppointmentCardContent';
import { getAppointmentRoomDisplay } from '@/app/lib/appointmentRoomDisplay';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';
import RowActionMenu, { RowMenuAction } from '@/app/ui/tables/RowActionMenu';

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
            <AvatarImage
              src={getSafeImageUrl(
                getAppointmentCompanionPhotoUrl(companion),
                companion.species as ImageType
              )}
              alt=""
              size={40}
              className="size-10 rounded-full object-cover"
              fallback={
                <CompanionAvatar
                  name={companion.name}
                  seed={companion.id}
                  size={40}
                  textClassName="text-[18px]"
                />
              }
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
          {/* min-w-0 + cell-truncate: the row is 140px and the Emergency chip takes
              half of it, so on an emergency the name had nothing left and
              `.appointment-profile-title`'s `overflow-wrap: anywhere` broke it
              mid-word - "Lily · Mathers" rendered as "Mather" / "s" over three
              lines. The chip keeps its size and the name ellipses instead. */}
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onViewAppointmentHistory(item)}
              className="appointment-profile-title cell-name cell-truncate min-w-0 cursor-pointer hover:underline underline-offset-2 text-left"
              title={formatCompanionNameWithOwnerLastName(
                item?.companion?.name,
                item?.companion?.parent
              )}
            >
              {formatCompanionNameWithOwnerLastName(item?.companion?.name, item?.companion?.parent)}
            </button>
            {item.isEmergency && (
              <div className="appointment-emergency-label shrink-0">Emergency</div>
            )}
          </div>
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
          <AppointmentModePill appointment={item} className="mt-1" iconSize={12} />
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

      // One line per staff member let a busy appointment grow the row without
      // bound. Show the first two and count the rest, as the chips elsewhere do.
      const shown = supportStaff.slice(0, 2);
      const hidden = supportStaff.length - shown.length;

      return (
        <div className="appointment-profile-two" title={supportStaff.map((s) => s.name).join(', ')}>
          {supportStaff.length > 0 ? (
            <>
              {shown.map((sup) => (
                <div key={sup.id} className="appointment-profile-sub cell-truncate">
                  {sup.name}
                </div>
              ))}
              {hidden > 0 && (
                <div className="appointment-profile-sub cell-overflow-count">{`+${hidden}`}</div>
              )}
            </>
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

      return (
        <div className="appointment-profile-two">
          <StatusPill
            tone={getAppointmentStatusTone(displayStatus)}
            label={toTitle(displayStatus)}
          />
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
    label: '',
    key: 'actions',
    width: '48px',
    render: (item: Appointment) => {
      const orgType = (item.organisationId && orgsById[item.organisationId]?.type) || 'HOSPITAL';
      const clinicalNotesLabel = getClinicalNotesLabel(orgType);
      const companionName = (item.companion ?? item.patient).name || 'appointment';

      /* Design collapses the row's action rail into a single overflow kebab;
         every action the rail carried lives on inside the menu. */
      const actions: RowMenuAction[] = [];

      if (isRequestedLikeStatus(item.status)) {
        actions.push(
          {
            key: 'accept-request',
            label: 'Accept request',
            icon: <FaCheckCircle size={15} aria-hidden="true" />,
            onSelect: () => onChangeStatusAppointment(item),
            primary: true,
          },
          {
            key: 'decline-request',
            label: 'Decline request',
            icon: <IoIosCloseCircle size={16} aria-hidden="true" />,
            onSelect: () => onCancelAppointment(item),
          }
        );
        return <RowActionMenu label={`Actions for ${companionName}`} actions={actions} />;
      }

      actions.push(
        {
          key: 'view-appointment',
          label: 'View appointment',
          icon: <IoEyeOutline size={15} aria-hidden="true" />,
          onSelect: () => onViewAppointment(item),
          primary: true,
        },
        {
          key: 'overview',
          label: 'Overview',
          icon: <RiHistoryLine size={15} aria-hidden="true" />,
          onSelect: () => onViewAppointmentHistory(item),
        }
      );
      if (canEditAppointments && canShowStatusChangeAction(item.status)) {
        actions.push({
          key: 'change-status',
          label: 'Change status',
          icon: <MdOutlineAutorenew size={15} aria-hidden="true" />,
          onSelect: () => onChangeStatusAppointment(item),
        });
      }
      if (canEditAppointments && allowCalendarDrag(item.status as any)) {
        actions.push({
          key: 'reschedule',
          label: 'Reschedule',
          icon: <IoIosCalendar size={15} aria-hidden="true" />,
          onSelect: () => onRescheduleAppointment(item),
        });
      }
      if (canEditAppointments && canAssignAppointmentRoom(item.status)) {
        actions.push({
          key: 'assign-room',
          label: 'Assign room',
          icon: <MdMeetingRoom size={15} aria-hidden="true" />,
          onSelect: () => onChangeRoomAppointment(item),
        });
      }
      actions.push(
        {
          key: 'clinical-notes',
          label: clinicalNotesLabel,
          icon: <IoDocumentTextOutline size={15} aria-hidden="true" />,
          onSelect: () => onWorkspaceAppointment(item, getSoapViewIntent(item)),
          dividerBefore: true,
        },
        {
          key: 'finance-summary',
          label: 'Finance summary',
          icon: <IoCardOutline size={15} aria-hidden="true" />,
          onSelect: () => onWorkspaceAppointment(item, { label: 'finance', subLabel: 'summary' }),
        },
        {
          key: 'lab-tests',
          label: 'Lab tests',
          icon: <MdScience size={15} aria-hidden="true" />,
          onSelect: () => onWorkspaceAppointment(item, { label: 'labs', subLabel: 'idexx-labs' }),
        }
      );

      return <RowActionMenu label={`Actions for ${companionName}`} actions={actions} />;
    },
  },
];
