import React from 'react';
import { useRouter } from 'next/navigation';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import AppointmentCard from '@/app/ui/cards/AppointmentCard';
import { Appointment } from '@yosemite-crew/types';

import {
  cancelAppointment,
  rejectAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { getPreferredNextAppointmentStatus } from '@/app/lib/appointments';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { AppointmentStatus } from '@/app/features/appointments/types/appointments';
import { useOrgStore } from '@/app/stores/orgStore';
import { useInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import { useLoadTeam, useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { createInvoiceByAppointmentId } from '@/app/lib/paymentStatus';
import { buildAppointmentCompanionHistoryHref } from '@/app/lib/companionHistoryRoute';
import {
  buildWorkspaceHrefForIntent,
  canEnterAppointmentWorkspace,
} from '@/app/lib/appointmentWorkspace';
import { startRouteLoader } from '@/app/lib/routeLoader';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { buildAppointmentColumns, normalizeLeadId } from '@/app/ui/tables/appointmentsTableColumns';

import './DataTable.css';
import PaginatedCardList from '@/app/ui/tables/PaginatedCardList';

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
  const encountersById = useAppointmentWorkspaceStore((s) => s.encountersById);
  const roomUnitsById = useOrganisationRoomStore((s) => s.roomUnitsById);
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
    if (setViewPopup) {
      setViewPopup(true);
      return;
    }
    setDetailPopup?.(true);
  };

  const handleWorkspaceAppointment = (appointment: Appointment, intent?: AppointmentViewIntent) => {
    if (!appointment.id) return;
    if (!canEnterAppointmentWorkspace(appointment.status)) {
      handleViewAppointment(appointment, intent);
      return;
    }
    startRouteLoader();
    router.push(buildWorkspaceHrefForIntent(appointment.id, intent));
  };

  const handleViewAppointmentHistory = (appointment: Appointment) => {
    startRouteLoader();
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

  const columns = buildAppointmentColumns({
    encountersById,
    roomUnitsById,
    leadNameByPractitionerId,
    orgsById,
    invoicesByAppointmentId,
    canEditAppointments,
    getSoapViewIntent,
    onViewAppointmentHistory: handleViewAppointmentHistory,
    onViewAppointment: handleViewAppointment,
    onChangeStatusAppointment: handleChangeStatusAppointment,
    onCancelAppointment: handleCancelAppointment,
    onRescheduleAppointment: handleRescheduleAppointment,
    onChangeRoomAppointment: handleChangeRoomAppointment,
    onWorkspaceAppointment: handleWorkspaceAppointment,
  });

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
          itemNoun="appointments"
          rowClassName={(item) => (item.isEmergency ? 'appointment-row-emergency' : '')}
        />
      </div>
      <PaginatedCardList
        items={filteredList}
        pageSize={small ? 5 : 10}
        className="xl:hidden"
        listClassName="pb-2 sm:pb-3"
        itemNoun="appointments"
        renderCard={(item) => (
          <AppointmentCard
            key={item.id}
            appointment={item}
            handleViewAppointment={handleViewAppointment}
            handleWorkspaceAppointment={handleWorkspaceAppointment}
            getSoapViewIntent={getSoapViewIntent}
            handleRescheduleAppointment={handleRescheduleAppointment}
            handleChangeStatusAppointment={handleChangeStatusAppointment}
            handleChangeRoomAppointment={handleChangeRoomAppointment}
            canEditAppointments={canEditAppointments}
          />
        )}
      />
    </div>
  );
};

const Appointments = React.memo(AppointmentsComponent);
export default Appointments;
