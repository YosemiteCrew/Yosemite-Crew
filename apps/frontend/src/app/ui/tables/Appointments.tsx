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
  setDetailPopup?: React.Dispatch<React.SetStateAction<boolean>>;
  setViewIntent?: (intent: AppointmentViewIntent | null) => void;
  setReschedulePopup?: React.Dispatch<React.SetStateAction<boolean>>;
  setChangeStatusPopup?: React.Dispatch<React.SetStateAction<boolean>>;
  setChangeStatusPreferredStatus?: React.Dispatch<React.SetStateAction<AppointmentStatus | null>>;
  setChangeRoomPopup?: React.Dispatch<React.SetStateAction<boolean>>;
  canEditAppointments: boolean;
  small?: boolean;
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

const AppointmentsComponent = ({
  filteredList,
  setActiveAppointment,
  setViewPopup,
  setDetailPopup,
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

  const handleDetailAppointment = (appointment: Appointment, intent?: AppointmentViewIntent) => {
    setActiveAppointment?.(appointment);
    setViewIntent?.(intent ?? null);
    setDetailPopup?.(true);
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

  const columns: Column<Appointment>[] = [
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
              onClick={() => handleViewAppointmentHistory(item)}
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
      width: '100px',
      render: (item: Appointment) => (
        <div className="appointment-profile-title">{item.room?.name || '-'}</div>
      ),
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

        if (isRequestedLikeStatus(item.status)) {
          return (
            <div className="action-btn-col">
              <div className="action-btn-grid action-btn-grid-capped">
                <GlassTooltip
                  content="Accept request"
                  side="bottom"
                  className="table-action-tooltip"
                >
                  <button
                    type="button"
                    className="action-btn"
                    style={{ background: 'var(--color-success-100)' }}
                    onClick={() => handleAcceptAppointment(item)}
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
                    onClick={() => handleCancelAppointment(item)}
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
              <GlassTooltip
                content="View appointment"
                side="bottom"
                className="table-action-tooltip"
              >
                <button
                  type="button"
                  onClick={() => handleViewAppointment(item)}
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                >
                  <IoEyeOutline size={20} color="var(--color-neutral-900)" />
                </button>
              </GlassTooltip>
              <GlassTooltip content="Overview" side="bottom" className="table-action-tooltip">
                <button
                  type="button"
                  onClick={() => handleViewAppointmentHistory(item)}
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                  title="Appointment overview"
                >
                  <RiHistoryLine size={18} color="var(--color-neutral-900)" />
                </button>
              </GlassTooltip>
              {canEditAppointments && canShowStatusChangeAction(item.status) && (
                <GlassTooltip
                  content="Change status"
                  side="bottom"
                  className="table-action-tooltip"
                >
                  <button
                    type="button"
                    onClick={() => handleChangeStatusAppointment(item)}
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
                    onClick={() => handleRescheduleAppointment(item)}
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
                    onClick={() => handleChangeRoomAppointment(item)}
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
                  onClick={() => handleDetailAppointment(item, getSoapViewIntent(item))}
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                  title={clinicalNotesLabel}
                >
                  <IoDocumentTextOutline size={18} color="var(--color-neutral-900)" />
                </button>
              </GlassTooltip>
              <GlassTooltip
                content="Finance summary"
                side="bottom"
                className="table-action-tooltip"
              >
                <button
                  type="button"
                  onClick={() =>
                    handleDetailAppointment(item, {
                      label: 'finance',
                      subLabel: 'summary',
                    })
                  }
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
                >
                  <IoCardOutline size={18} color="var(--color-neutral-900)" />
                </button>
              </GlassTooltip>
              <GlassTooltip content="Lab tests" side="bottom" className="table-action-tooltip">
                <button
                  type="button"
                  onClick={() =>
                    handleDetailAppointment(item, {
                      label: 'labs',
                      subLabel: 'idexx-labs',
                    })
                  }
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

  return (
    <div className="table-wrapper appointments-scroll-x h-full min-h-0 overflow-hidden">
      <div className="table-list h-full min-h-0 overflow-y-auto pr-1">
        <GenericTable
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination={true}
          pageSize={small ? 5 : 10}
          tableClassName="appointments-table-fixed"
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
          return filteredList.map((item) => (
            <AppointmentCard
              key={item.id}
              appointment={item}
              handleViewAppointment={handleViewAppointment}
              handleDetailAppointment={handleDetailAppointment}
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

const Appointments = React.memo(AppointmentsComponent);
export default Appointments;
