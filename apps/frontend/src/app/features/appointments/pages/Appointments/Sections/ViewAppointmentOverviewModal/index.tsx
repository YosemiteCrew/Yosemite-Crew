'use client';
import React, { useCallback, useMemo, useState } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import { useInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import { useOrgStore } from '@/app/stores/orgStore';
import { useServiceStore } from '@/app/stores/serviceStore';
import { useParentStore } from '@/app/stores/parentStore';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  canAssignAppointmentRoom,
  getClinicalNotesIntent,
  getAppointmentCompanion,
} from '@/app/lib/appointments';
import {
  canEnterAppointmentWorkspace,
  getWorkspaceBlockedMessage,
} from '@/app/lib/appointmentWorkspace';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';
import { formatTimeLabel } from '@/app/lib/forms';
import { createInvoiceByAppointmentId } from '@/app/lib/paymentStatus';
import { formatMoney } from '@/app/lib/money';
import { normalizeAppointmentId } from '@/app/lib/invoice';
import {
  assignEncounterUnit,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { loadRoomsForOrgPrimaryOrg } from '@/app/features/organization/services/roomService';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { useNotify } from '@/app/hooks/useNotify';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import AppointmentCentralModalShell from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentCentralModalShell';
import AppointmentAvatar from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentAvatar';
import AppointmentStatusPill from '@/app/features/appointments/components/AppointmentStatusPill';
import { Primary } from '@/app/ui/primitives/Buttons';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { IoArrowForward } from 'react-icons/io5';
import {
  getAssignableRoomUnits,
  getFirstAssignableRoomUnitId,
  toAssignableRoomOptions,
} from '@/app/features/appointments/lib/roomUnitAvailability';

type ViewAppointmentOverviewModalProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeAppointment: Appointment;
  canEditAppointments?: boolean;
  onOpenDetails: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
};

type OverviewRowProps = {
  label: string;
  value: React.ReactNode;
};

type ParentImageFields = {
  profileImageUrl?: string | null;
  profileUrl?: string | null;
  photoUrl?: string | null;
  image?: string | null;
};

const getFirstText = (...values: Array<string | null | undefined>): string | undefined =>
  values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim();

const normalizePersonId = (value?: string | null): string =>
  String(value ?? '')
    .trim()
    .split('/')
    .pop()
    ?.toLowerCase() ?? '';

const getParentPhotoUrl = (
  appointmentParent: ParentImageFields | undefined,
  storedParent: ParentImageFields | undefined
): string | undefined =>
  getFirstText(
    storedParent?.profileImageUrl,
    storedParent?.profileUrl,
    storedParent?.photoUrl,
    storedParent?.image,
    appointmentParent?.profileImageUrl,
    appointmentParent?.profileUrl,
    appointmentParent?.photoUrl,
    appointmentParent?.image
  );

const OverviewRow = ({ label, value }: OverviewRowProps) => (
  <div className="flex items-center justify-between py-2 border-b border-card-border last:border-0">
    <span className="font-satoshi text-sm font-medium text-text-secondary">{label}</span>
    <span className="font-satoshi text-sm text-text-primary text-right max-w-[60%] truncate">
      {value || '-'}
    </span>
  </div>
);

// Money prints as "$143.00"; an empty money slot is an em dash. The estimate's
// ink branches on this same value, so the two can never drift apart.
const EMPTY_VALUE = '—';

const resolveEstimateDisplay = (
  appointmentId: string | undefined,
  invoicesByAppointmentId: Record<string, import('@yosemite-crew/types').Invoice>,
  serviceInfoCost: string | number,
  serviceInfoMaxDiscount: string | number
): string => {
  const normalizedId = normalizeAppointmentId(appointmentId);
  if (normalizedId) {
    const invoice = invoicesByAppointmentId[normalizedId];
    if (invoice?.totalAmount !== undefined) {
      return formatMoney(invoice.totalAmount, invoice.currency);
    }
  }
  const cost = Number(serviceInfoCost) || 0;
  const discount = Number(serviceInfoMaxDiscount) || 0;
  const estimate = Math.max(0, cost - discount);
  if (estimate > 0) return `$${estimate.toFixed(2)}`;
  if (cost > 0) return `$${cost.toFixed(2)}`;
  return EMPTY_VALUE;
};

type RoomSelectorSectionProps = {
  label: string;
  saving: boolean;
  canEditRoom: boolean;
  options: Array<{ label: string; value: string }>;
  defaultOption: string;
  onSelect: (option: { label: string; value: string }) => void;
  fallback: string;
};

const RoomSelectorSection = ({
  label,
  saving,
  canEditRoom,
  options,
  defaultOption,
  onSelect,
  fallback,
}: RoomSelectorSectionProps) =>
  canEditRoom ? (
    // The label always stays "Room"/"Unit" - Room and Unit save independently
    // (see savingField in the parent), so only the field actually in flight
    // dims, instead of both losing their identity to a shared "Saving…" state.
    <div className={saving ? 'pointer-events-none opacity-60' : ''}>
      <LabelDropdown
        placeholder={label}
        options={options}
        defaultOption={defaultOption}
        onSelect={onSelect}
        searchable={false}
      />
    </div>
  ) : (
    <div>
      <span className="mb-1.5 block font-satoshi text-sm font-semibold text-text-secondary">
        {label}
      </span>
      <div className="border border-input-border-default rounded-2xl px-4 py-3 min-h-12 font-satoshi text-base text-text-primary">
        {fallback}
      </div>
    </div>
  );

type OverviewLeftColumnProps = {
  companion: ReturnType<typeof getAppointmentCompanion>;
  terminologyText: ReturnType<typeof useCompanionTerminologyText>;
  clientPhotoUrl: string | undefined;
  activeAppointment: Appointment;
  leadPhotoUrl: string | undefined;
  supportDisplay: string;
  dateDisplay: string;
  timeDisplay: string;
  durationDisplay: string;
};

const OverviewLeftColumn = ({
  companion,
  terminologyText,
  clientPhotoUrl,
  activeAppointment,
  leadPhotoUrl,
  supportDisplay,
  dateDisplay,
  timeDisplay,
  durationDisplay,
}: OverviewLeftColumnProps) => (
  <div className="flex flex-col gap-4">
    {/* Patient */}
    <div className="flex items-center gap-3 p-3 rounded-2xl border border-card-border">
      <AppointmentAvatar
        name={companion.name}
        photoUrl={(companion as Appointment['patient'] & { photoUrl?: string }).photoUrl}
      />
      <div className="min-w-0">
        <div className="text-sm text-text-extra">{terminologyText('Patient')}</div>
        <div className="font-satoshi text-base text-text-primary truncate">
          {companion.name || '-'}
        </div>
      </div>
    </div>

    {/* Client */}
    {companion.parent?.name && (
      <div className="flex items-center gap-3 p-3 rounded-2xl border border-card-border">
        <AppointmentAvatar name={companion.parent.name} photoUrl={clientPhotoUrl} />
        <div className="min-w-0">
          <div className="text-sm text-text-extra">Client</div>
          <div className="font-satoshi text-base text-text-primary truncate">
            {companion.parent.name}
          </div>
        </div>
      </div>
    )}

    {/* Lead */}
    {activeAppointment.lead && (
      <div className="flex items-center gap-3 p-3 rounded-2xl border border-card-border">
        <AppointmentAvatar name={activeAppointment.lead.name ?? ''} photoUrl={leadPhotoUrl} />
        <div className="min-w-0">
          <div className="text-sm text-text-extra">Lead</div>
          <div className="font-satoshi text-base text-text-primary truncate">
            {activeAppointment.lead.name || '-'}
          </div>
        </div>
      </div>
    )}

    {/* Support */}
    {(activeAppointment.supportStaff?.length ?? 0) > 0 && (
      <div className="p-3 rounded-2xl border border-card-border">
        <div className="text-sm text-text-extra mb-1">Support</div>
        <div className="font-satoshi text-sm text-text-primary">{supportDisplay}</div>
      </div>
    )}

    {/* Date / Time / Duration */}
    <div className="rounded-2xl border border-card-border px-4 py-2">
      <OverviewRow label="Date" value={dateDisplay} />
      <OverviewRow label="Time" value={timeDisplay} />
      <OverviewRow label="Duration" value={durationDisplay} />
    </div>
  </div>
);

type OverviewRightColumnProps = {
  activeAppointment: Appointment;
  canEditAppointments: boolean;
  savingField: 'room' | 'unit' | null;
  canEditRoom: boolean;
  roomOptions: Array<{ label: string; value: string }>;
  effectiveRoomId: string | undefined;
  handleRoomChange: (option: { label: string; value: string }) => void;
  rooms: ReturnType<typeof useRoomsForPrimaryOrg>;
  isInpatient: boolean;
  unitOptions: Array<{ label: string; value: string }>;
  effectiveUnitId: string | undefined;
  handleUnitChange: (option: { label: string; value: string }) => void;
  serviceInfo: ReturnType<typeof useServiceStore.getState>['getServicesBySpecialityId'] extends (
    ...args: never[]
  ) => (infer Item)[]
    ? Item | null
    : never;
  estimateDisplay: string;
};

const OverviewRightColumn = ({
  activeAppointment,
  canEditAppointments,
  savingField,
  canEditRoom,
  roomOptions,
  effectiveRoomId,
  handleRoomChange,
  rooms,
  isInpatient,
  unitOptions,
  effectiveUnitId,
  handleUnitChange,
  serviceInfo,
  estimateDisplay,
}: OverviewRightColumnProps) => (
  <div className="flex flex-col gap-4">
    {/* Appointment detail rows */}
    <div className="rounded-2xl border border-card-border px-4 py-2">
      <div className="flex items-center justify-between py-2 border-b border-card-border">
        <span className="font-satoshi text-sm font-medium text-text-secondary">Status</span>
        <AppointmentStatusPill appointment={activeAppointment} canEdit={canEditAppointments} />
      </div>
      <OverviewRow label="Speciality" value={activeAppointment.appointmentType?.speciality?.name} />
      <OverviewRow label="Service" value={activeAppointment.appointmentType?.name} />
      <OverviewRow label="Chief complaint" value={activeAppointment.concern} />
      <OverviewRow label="Emergency" value={activeAppointment.isEmergency ? 'Yes' : 'No'} />
    </div>

    {/* Room */}
    <RoomSelectorSection
      label="Room"
      saving={savingField === 'room'}
      canEditRoom={canEditRoom}
      options={roomOptions}
      defaultOption={effectiveRoomId ?? ''}
      onSelect={handleRoomChange}
      fallback={
        rooms.find((room) => room.id === effectiveRoomId)?.name ||
        activeAppointment.room?.name ||
        '-'
      }
    />

    {isInpatient ? (
      <RoomSelectorSection
        label="Unit"
        saving={savingField === 'unit'}
        canEditRoom={canEditRoom}
        options={unitOptions}
        defaultOption={effectiveUnitId ?? ''}
        onSelect={handleUnitChange}
        fallback={
          unitOptions.find((unit) => unit.value === effectiveUnitId)?.label ||
          effectiveUnitId ||
          '-'
        }
      />
    ) : null}

    {/* Estimate panel */}
    {activeAppointment.status !== 'COMPLETED' && (
      <div className="rounded-2xl border border-card-border p-4 flex flex-col gap-2">
        {serviceInfo && (
          <>
            <div className="flex items-center justify-between">
              <span className="font-satoshi text-sm font-medium text-text-secondary">Cost:</span>
              <span className="font-satoshi text-sm font-bold text-text-primary">
                {serviceInfo.cost ? `$${Number(serviceInfo.cost).toFixed(2)}` : EMPTY_VALUE}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-satoshi text-sm font-medium text-text-secondary">
                Max discount:
              </span>
              <span className="font-satoshi text-sm font-bold text-text-primary">
                {serviceInfo.maxDiscount
                  ? `$${Number(serviceInfo.maxDiscount).toFixed(2)}`
                  : EMPTY_VALUE}
              </span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between mt-1">
          <span
            className="font-satoshi text-sm font-medium"
            style={{ color: 'var(--color-neutral-900)', letterSpacing: '-0.28px' }}
          >
            Estimate
          </span>
          <span
            className="font-satoshi text-2xl font-bold"
            style={{
              color:
                estimateDisplay === EMPTY_VALUE ? 'var(--color-text-tertiary)' : 'var(--blue-text)',
              letterSpacing: '-0.48px',
            }}
          >
            {estimateDisplay}
          </span>
        </div>
      </div>
    )}
  </div>
);

const ViewAppointmentOverviewModal = ({
  showModal,
  setShowModal,
  activeAppointment,
  canEditAppointments = false,
  onOpenDetails,
}: ViewAppointmentOverviewModalProps) => {
  const terminologyText = useCompanionTerminologyText();
  const { notify } = useNotify();
  const rooms = useRoomsForPrimaryOrg();
  const roomUnitsById = useOrganisationRoomStore((s) => s.roomUnitsById);
  const roomUnitIdsByRoomId = useOrganisationRoomStore((s) => s.roomUnitIdsByRoomId);
  const setRoomUnitOccupied = useOrganisationRoomStore((s) => s.setRoomUnitOccupied);
  const invoices = useInvoicesForPrimaryOrg();
  const orgsById = useOrgStore((s) => s.orgsById);
  const companion = getAppointmentCompanion(activeAppointment);
  const parentRecord = useParentStore((s) =>
    companion.parent?.id ? s.parentsById[companion.parent.id] : undefined
  );
  const team = useTeamForPrimaryOrg();
  const getServicesBySpecialityId = useServiceStore.getState().getServicesBySpecialityId;
  const initEncounter = useAppointmentWorkspaceStore((s) => s.initEncounter);
  const setRoomUnit = useAppointmentWorkspaceStore((s) => s.setRoomUnit);
  const encounter = useAppointmentWorkspaceStore((s) =>
    activeAppointment.id ? s.encountersById[activeAppointment.id] : undefined
  );

  const [savingField, setSavingField] = useState<'room' | 'unit' | null>(null);

  React.useEffect(() => {
    if (!showModal) return;
    loadRoomsForOrgPrimaryOrg({ force: true, silent: true }).catch(() => undefined);
  }, [showModal]);
  const isInpatient = activeAppointment.appointmentKind === 'INPATIENT';
  const appointmentParent = companion.parent as
    (typeof companion.parent & ParentImageFields) | undefined;
  const leadPhotoUrl = useMemo(() => {
    const appointmentLeadId = normalizePersonId(activeAppointment.lead?.id);
    const teamLead = team.find((member) => {
      const practitionerId = normalizePersonId(member.practionerId);
      const memberId = normalizePersonId(member._id);
      return practitionerId === appointmentLeadId || memberId === appointmentLeadId;
    });
    return getFirstText(activeAppointment.lead?.profileUrl, teamLead?.image);
  }, [activeAppointment.lead?.id, activeAppointment.lead?.profileUrl, team]);
  const clientPhotoUrl = getParentPhotoUrl(appointmentParent, parentRecord);

  const orgType =
    (activeAppointment.organisationId && orgsById[activeAppointment.organisationId]?.type) ||
    'HOSPITAL';

  const clinicalNotesIntent = getClinicalNotesIntent(orgType);
  const isUpcoming = activeAppointment.status === 'UPCOMING';
  const canOpenWorkspace = canEnterAppointmentWorkspace(activeAppointment.status);
  const canEditRoom = canAssignAppointmentRoom(activeAppointment.status);

  const invoicesByAppointmentId = useMemo(() => createInvoiceByAppointmentId(invoices), [invoices]);

  const effectiveRoomId = encounter?.roomId ?? activeAppointment.room?.id;
  const currentUnitId = encounter?.unitId;
  const roomIndexes = useMemo(
    () => ({ roomUnitsById, roomUnitIdsByRoomId }),
    [roomUnitIdsByRoomId, roomUnitsById]
  );
  const effectiveUnitId =
    currentUnitId ?? getFirstAssignableRoomUnitId(effectiveRoomId, roomIndexes, currentUnitId);
  const roomOptions = useMemo(
    () => toAssignableRoomOptions(rooms, roomIndexes, effectiveRoomId, currentUnitId, isInpatient),
    [currentUnitId, effectiveRoomId, isInpatient, roomIndexes, rooms]
  );
  const unitOptions = useMemo(
    () =>
      getAssignableRoomUnits(effectiveRoomId, roomIndexes, currentUnitId).map((unit) => ({
        label: unit.displayName || unit.code,
        value: unit.id,
      })),
    [currentUnitId, effectiveRoomId, roomIndexes]
  );

  const serviceInfo = useMemo(() => {
    const specialityId = activeAppointment.appointmentType?.speciality?.id;
    const serviceId = activeAppointment.appointmentType?.id;
    if (!specialityId || !serviceId) return null;
    const services = getServicesBySpecialityId(specialityId);
    return services.find((s) => s.id === serviceId) ?? null;
  }, [activeAppointment.appointmentType, getServicesBySpecialityId]);

  const estimateDisplay = useMemo(
    () =>
      resolveEstimateDisplay(
        activeAppointment.id,
        invoicesByAppointmentId,
        serviceInfo?.cost ?? '',
        serviceInfo?.maxDiscount ?? ''
      ),
    [activeAppointment.id, invoicesByAppointmentId, serviceInfo]
  );

  const dateDisplay = useMemo(() => {
    try {
      return formatDateInPreferredTimeZone(activeAppointment.appointmentDate, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '-';
    }
  }, [activeAppointment.appointmentDate]);

  const timeDisplay = useMemo(
    () => formatTimeLabel(activeAppointment.startTime) || '-',
    [activeAppointment.startTime]
  );

  const durationDisplay = activeAppointment.durationMinutes
    ? `${activeAppointment.durationMinutes} mins`
    : '-';

  const supportDisplay =
    activeAppointment.supportStaff?.flatMap((s) => (s.name ? [s.name] : [])).join(', ') || '-';

  const handleRoomChange = useCallback(
    async (option: { label: string; value: string }) => {
      if (!canEditRoom) return;
      setSavingField('room');
      try {
        const foundRoom = rooms.find((r) => r.id === option.value);
        const nextUnitId = isInpatient
          ? getFirstAssignableRoomUnitId(option.value, roomIndexes, currentUnitId)
          : undefined;
        await updateAppointment({
          ...activeAppointment,
          room: foundRoom ? { id: foundRoom.id, name: foundRoom.name } : undefined,
        });
        if (isInpatient && activeAppointment.id) {
          initEncounter(activeAppointment.id, 'INPATIENT', {
            leadId: activeAppointment.lead?.id,
            leadName: activeAppointment.lead?.name,
          });
          setRoomUnit(activeAppointment.id, option.value, nextUnitId);
          if (activeAppointment.encounterId && nextUnitId) {
            await assignEncounterUnit({
              encounterId: activeAppointment.encounterId,
              unitId: nextUnitId,
              reason: 'Appointment overview room assignment',
            });
            setRoomUnitOccupied(currentUnitId, false);
            setRoomUnitOccupied(nextUnitId, true);
            await loadRoomsForOrgPrimaryOrg({ force: true, silent: true });
          }
        }
      } catch {
        notify('error', { title: 'Room update failed', text: 'Please try again.' });
      } finally {
        setSavingField(null);
      }
    },
    [
      activeAppointment,
      canEditRoom,
      initEncounter,
      isInpatient,
      notify,
      currentUnitId,
      roomIndexes,
      rooms,
      setRoomUnit,
      setRoomUnitOccupied,
      setSavingField,
    ]
  );

  const handleUnitChange = useCallback(
    async (option: { label: string; value: string }) => {
      if (!canEditRoom || !isInpatient || !activeAppointment.id) return;
      setSavingField('unit');
      try {
        initEncounter(activeAppointment.id, 'INPATIENT', {
          leadId: activeAppointment.lead?.id,
          leadName: activeAppointment.lead?.name,
        });
        setRoomUnit(activeAppointment.id, effectiveRoomId, option.value);
        if (activeAppointment.encounterId) {
          await assignEncounterUnit({
            encounterId: activeAppointment.encounterId,
            unitId: option.value,
            reason: 'Appointment overview unit assignment',
          });
          setRoomUnitOccupied(currentUnitId, false);
          setRoomUnitOccupied(option.value, true);
          await loadRoomsForOrgPrimaryOrg({ force: true, silent: true });
        }
      } catch {
        notify('error', { title: 'Unit update failed', text: 'Please try again.' });
      } finally {
        setSavingField(null);
      }
    },
    [
      activeAppointment.encounterId,
      activeAppointment.id,
      activeAppointment.lead,
      canEditRoom,
      effectiveRoomId,
      initEncounter,
      isInpatient,
      notify,
      setRoomUnit,
      currentUnitId,
      setRoomUnitOccupied,
      setSavingField,
    ]
  );

  const handlePrimaryAction = () => {
    if (!canOpenWorkspace) return;
    onOpenDetails(activeAppointment, isUpcoming ? clinicalNotesIntent : undefined);
  };

  return (
    <AppointmentCentralModalShell
      showModal={showModal}
      setShowModal={setShowModal}
      title="Appointment details"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <OverviewLeftColumn
          companion={companion}
          terminologyText={terminologyText}
          clientPhotoUrl={clientPhotoUrl}
          activeAppointment={activeAppointment}
          leadPhotoUrl={leadPhotoUrl}
          supportDisplay={supportDisplay}
          dateDisplay={dateDisplay}
          timeDisplay={timeDisplay}
          durationDisplay={durationDisplay}
        />

        <OverviewRightColumn
          activeAppointment={activeAppointment}
          canEditAppointments={canEditAppointments}
          savingField={savingField}
          canEditRoom={canEditRoom}
          roomOptions={roomOptions}
          effectiveRoomId={effectiveRoomId}
          handleRoomChange={handleRoomChange}
          rooms={rooms}
          isInpatient={isInpatient}
          unitOptions={unitOptions}
          effectiveUnitId={effectiveUnitId}
          handleUnitChange={handleUnitChange}
          serviceInfo={serviceInfo}
          estimateDisplay={estimateDisplay}
        />
      </div>

      {!canOpenWorkspace && (
        <p className="mt-5 rounded-2xl border border-card-border bg-neutral-100 p-4 text-body-4 text-text-secondary">
          {getWorkspaceBlockedMessage(activeAppointment.status)}
        </p>
      )}

      {/* Footer */}
      <div className="flex justify-end mt-6 pt-4 border-t border-card-border">
        <Primary
          text={isUpcoming ? 'Start appointment' : 'View details'}
          icon={<IoArrowForward aria-hidden="true" />}
          iconPosition="right"
          onClick={handlePrimaryAction}
          isDisabled={!canOpenWorkspace}
        />
      </div>
    </AppointmentCentralModalShell>
  );
};

export default ViewAppointmentOverviewModal;
