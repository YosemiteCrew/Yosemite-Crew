import React from 'react';
import { useRouter } from 'next/navigation';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import Image from 'next/image';
import { FaCheckCircle } from 'react-icons/fa';
import { IoIosCloseCircle, IoIosCalendar } from 'react-icons/io';
import { IoEyeOutline, IoCardOutline, IoDocumentTextOutline } from 'react-icons/io5';
import { MdMeetingRoom, MdOutlineAutorenew, MdScience } from 'react-icons/md';
import { RiHistoryLine } from 'react-icons/ri';
import AppointmentCard from '@/app/ui/cards/AppointmentCard';
import { Appointment } from '@yosemite-crew/types';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';

import {
  acceptAppointment,
  cancelAppointment,
  rejectAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { toTitle } from '@/app/lib/validators';
import {
  allowCalendarDrag,
  canAssignAppointmentRoom,
  canShowStatusChangeAction,
  getAppointmentCompanionPhotoUrl,
  getPreferredNextAppointmentStatus,
  getClinicalNotesLabel,
  isRequestedLikeStatus,
} from '@/app/lib/appointments';
import { getStatusStyle } from '@/app/config/statusConfig';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { AppointmentStatus } from '@/app/features/appointments/types/appointments';
import { useOrgStore } from '@/app/stores/orgStore';
import { useInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import { useLoadTeam, useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  createInvoiceByAppointmentId,
  getAppointmentPaymentDisplay,
} from '@/app/lib/paymentStatus';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { formatCompanionNameWithOwnerLastName, getOwnerFirstName } from '@/app/lib/companionName';
import { buildAppointmentCompanionHistoryHref } from '@/app/lib/companionHistoryRoute';

import './DataTable.css';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';

const normalizeLeadId = (value?: string | null): string => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  const lowered = trimmed.toLowerCase();
  return lowered === 'undefined' || lowered === 'null' ? '' : trimmed;
};

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type AppointmentTableProps = {
  filteredList: Appointment[];
  setActiveAppointment?: (appointment: Appointment) => void;
  setViewPopup?: React.Dispatch<React.SetStateAction<boolean>>;
  setViewIntent?: (intent: AppointmentViewIntent | null) => void;
  setReschedulePopup?: React.Dispatch<React.SetStateAction<boolean>>;
  setChangeStatusPopup?: React.Dispatch<React.SetStateAction<boolean>>;
  setChangeStatusPreferredStatus?: React.Dispatch<React.SetStateAction<AppointmentStatus | null>>;
  setChangeRoomPopup?: React.Dispatch<React.SetStateAction<boolean>>;
  canEditAppointments: boolean;
  small?: boolean;
};

const Appointments = ({
  filteredList,
  setActiveAppointment,
  setViewPopup,
  setViewIntent,
  setReschedulePopup,
  setChangeStatusPopup,
  setChangeStatusPreferredStatus,
  setChangeRoomPopup,
  canEditAppointments,
  small = false,
}: AppointmentTableProps) => {
  const router = useRouter();
  useLoadTeam();
  const teams = useTeamForPrimaryOrg();
  const orgsById = useOrgStore((s) => s.orgsById);
  const invoices = useInvoicesForPrimaryOrg();
  const invoicesByAppointmentId = React.useMemo(
    () => createInvoiceByAppointmentId(invoices),
    [invoices]
  );
  const leadNameByPractitionerId = React.useMemo(() => {
    const map = new Map<string, string>();
    teams.forEach((team) => {
      const practitionerId = normalizeLeadId(team.practionerId);
      if (!practitionerId) return;
      const displayName = team.name?.trim() || practitionerId;
      map.set(practitionerId, displayName);
    });
    return map;
  }, [teams]);

  const getSoapViewIntent = (appointment: Appointment): AppointmentViewIntent => {
    const orgType =
      (appointment.organisationId && orgsById[appointment.organisationId]?.type) || 'HOSPITAL';

    if (orgType === 'HOSPITAL') {
      return { label: 'prescription', subLabel: 'subjective' };
    }

    return { label: 'care', subLabel: 'forms' };
  };

  const handleViewAppointment = (appointment: Appointment, intent?: AppointmentViewIntent) => {
    setActiveAppointment?.(appointment);
    setViewIntent?.(intent ?? null);
    setViewPopup?.(true);
  };

  const handleViewAppointmentHistory = (appointment: Appointment) => {
    router.push(
      buildAppointmentCompanionHistoryHref(
        appointment.id,
        appointment.companion?.id,
        '/appointments'
      )
    );
  };

  const handleRescheduleAppointment = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setReschedulePopup?.(true);
  };

  const handleChangeStatusAppointment = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setChangeStatusPreferredStatus?.(getPreferredNextAppointmentStatus(appointment.status));
    setChangeStatusPopup?.(true);
  };

  const handleChangeRoomAppointment = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setChangeRoomPopup?.(true);
  };

  const handleAcceptAppointment = async (appointment: Appointment) => {
    try {
      await acceptAppointment(appointment);
    } catch (error) {
      console.log(error);
    }
  };

  const handleCancelAppointment = async (appointment: Appointment) => {
    try {
      if (appointment.status === 'REQUESTED') {
        await rejectAppointment(appointment);
        return;
      }
      await cancelAppointment(appointment);
    } catch (error) {
      console.log(error);
    }
  };

  const columns: Column<Appointment>[] = [
    {
      label: '',
      key: 'logo',
      width: '5%',
      render: (item: Appointment) => (
        <div className="appointment-profile w-10 h-10">
          <Image
            src={getSafeImageUrl(
              getAppointmentCompanionPhotoUrl(item.companion),
              item.companion.species as ImageType
            )}
            alt=""
            height={40}
            width={40}
            className="h-10 w-10 rounded-full object-cover"
          />
        </div>
      ),
    },
    {
      label: 'Name',
      key: 'name',
      width: '10%',
      render: (item: Appointment) => (
        <div className="appointment-profile truncate">
          <div className="appointment-profile-two">
            <button
              type="button"
              onClick={() => handleViewAppointmentHistory(item)}
              className="appointment-profile-title cursor-pointer hover:underline underline-offset-2 text-left"
              title="Open appointment overview"
            >
              {formatCompanionNameWithOwnerLastName(item?.companion?.name, item?.companion?.parent)}
            </button>
            <div className="appointment-profile-sub truncate">
              {getOwnerFirstName(item?.companion?.parent) || ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      label: 'Reason',
      key: 'reason',
      width: '10%',
      render: (item: Appointment) => (
        <div className="appointment-profile-two truncate">
          <div className="appointment-profile-title">{item.concern || '-'}</div>
          {item.isEmergency && <div className="appointment-emergency-label">Emergency</div>}
        </div>
      ),
    },
    {
      label: 'Service',
      key: 'service',
      width: '10%',
      render: (item: Appointment) => (
        <div className="appointment-profile-title">{item.appointmentType?.name || '-'}</div>
      ),
    },
    {
      label: 'Room',
      key: 'room',
      width: '10%',
      render: (item: Appointment) => (
        <div className="appointment-profile-title">{item.room?.name || '-'}</div>
      ),
    },
    {
      label: 'Date/Time',
      key: 'date/time',
      width: '10%',
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
      width: '10%',
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
      width: '10%',
      render: (item: Appointment) => {
        const supportStaff = item.supportStaff ?? [];

        return (
          <div className="appointment-profile-two">
            {supportStaff.length > 0 ? (
              supportStaff.map((sup, i) => (
                <div key={'sup' + i} className="appointment-profile-sub">
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
      width: '15%',
      render: (item: Appointment) => {
        const displayStatus = item.status === 'REQUESTED' ? 'REQUESTED' : item.status;
        const payment = getAppointmentPaymentDisplay(item, invoicesByAppointmentId);

        return (
          <div className="appointment-profile-two">
            <div className="appointment-status" style={getStatusStyle(displayStatus)}>
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
      width: '10%',
      render: (item: Appointment) => {
        const orgType = (item.organisationId && orgsById[item.organisationId]?.type) || 'HOSPITAL';
        const clinicalNotesLabel = getClinicalNotesLabel(orgType);

        if (isRequestedLikeStatus(item.status)) {
          return (
            <div className="action-btn-col">
              <GlassTooltip content="Accept request" side="bottom" className="table-action-tooltip">
                <button
                  className="action-btn"
                  style={{ background: '#E6F4EF' }}
                  onClick={() => handleAcceptAppointment(item)}
                >
                  <FaCheckCircle size={22} color="#54B492" />
                </button>
              </GlassTooltip>
              <GlassTooltip
                content="Decline request"
                side="bottom"
                className="table-action-tooltip"
              >
                <button
                  onClick={() => handleCancelAppointment(item)}
                  className="action-btn"
                  style={{ background: '#FDEBEA' }}
                >
                  <IoIosCloseCircle size={24} color="#EA3729" />
                </button>
              </GlassTooltip>
            </div>
          );
        }

        return (
          <div className="action-btn-col">
            <div className="action-btn-grid">
              <GlassTooltip
                content="View appointment"
                side="bottom"
                className="table-action-tooltip"
              >
                <button
                  onClick={() => handleViewAppointment(item)}
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                >
                  <IoEyeOutline size={20} color="#302F2E" />
                </button>
              </GlassTooltip>
              <GlassTooltip content="Overview" side="bottom" className="table-action-tooltip">
                <button
                  onClick={() => handleViewAppointmentHistory(item)}
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                  title="Appointment overview"
                >
                  <RiHistoryLine size={18} color="#302F2E" />
                </button>
              </GlassTooltip>
              {canEditAppointments && canShowStatusChangeAction(item.status) && (
                <GlassTooltip
                  content="Change status"
                  side="bottom"
                  className="table-action-tooltip"
                >
                  <button
                    onClick={() => handleChangeStatusAppointment(item)}
                    className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                  >
                    <MdOutlineAutorenew size={18} color="#302F2E" />
                  </button>
                </GlassTooltip>
              )}
              {canEditAppointments && allowCalendarDrag(item.status as any) && (
                <GlassTooltip content="Reschedule" side="bottom" className="table-action-tooltip">
                  <button
                    onClick={() => handleRescheduleAppointment(item)}
                    className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                  >
                    <IoIosCalendar size={18} color="#302F2E" />
                  </button>
                </GlassTooltip>
              )}
              {canEditAppointments && canAssignAppointmentRoom(item.status) && (
                <GlassTooltip content="Assign room" side="bottom" className="table-action-tooltip">
                  <button
                    onClick={() => handleChangeRoomAppointment(item)}
                    className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                  >
                    <MdMeetingRoom size={18} color="#302F2E" />
                  </button>
                </GlassTooltip>
              )}
              <GlassTooltip
                content={clinicalNotesLabel}
                side="bottom"
                className="table-action-tooltip"
              >
                <button
                  onClick={() => handleViewAppointment(item, getSoapViewIntent(item))}
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                  title={clinicalNotesLabel}
                >
                  <IoDocumentTextOutline size={18} color="#302F2E" />
                </button>
              </GlassTooltip>
              <GlassTooltip
                content="Finance summary"
                side="bottom"
                className="table-action-tooltip"
              >
                <button
                  onClick={() =>
                    handleViewAppointment(item, {
                      label: 'finance',
                      subLabel: 'summary',
                    })
                  }
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                >
                  <IoCardOutline size={18} color="#302F2E" />
                </button>
              </GlassTooltip>
              <GlassTooltip content="Lab tests" side="bottom" className="table-action-tooltip">
                <button
                  onClick={() =>
                    handleViewAppointment(item, {
                      label: 'labs',
                      subLabel: 'idexx-labs',
                    })
                  }
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                >
                  <MdScience size={18} color="#302F2E" />
                </button>
              </GlassTooltip>
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div className="table-wrapper h-full min-h-0 overflow-hidden">
      <div className="table-list h-full min-h-0 overflow-y-auto pr-1 pb-3">
        <GenericTable
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination={true}
          pageSize={small ? 5 : 10}
        />
      </div>
      <div className="xl:hidden h-full min-h-0 overflow-y-auto pr-1 pb-2 sm:pb-3 flex gap-4 sm:gap-6 flex-wrap content-start">
        {(() => {
          if (filteredList.length === 0) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
                No data available
              </div>
            );
          }
          return filteredList.map((item, i) => (
            <AppointmentCard
              key={'key-appointment' + i}
              appointment={item}
              handleViewAppointment={handleViewAppointment}
              getSoapViewIntent={getSoapViewIntent}
              handleRescheduleAppointment={handleRescheduleAppointment}
              handleChangeStatusAppointment={handleChangeStatusAppointment}
              handleChangeRoomAppointment={handleChangeRoomAppointment}
              canEditAppointments={canEditAppointments}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default Appointments;
