'use client';
import React, { useCallback, useMemo, useState } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import { useInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import { useOrgStore } from '@/app/stores/orgStore';
import { useServiceStore } from '@/app/stores/serviceStore';
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
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { useNotify } from '@/app/hooks/useNotify';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import AppointmentCentralModalShell from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentCentralModalShell';
import AppointmentAvatar from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentAvatar';
import AppointmentStatusPill from '@/app/features/appointments/components/AppointmentStatusPill';
import { Primary } from '@/app/ui/primitives/Buttons';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { IoArrowForward } from 'react-icons/io5';

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

const OverviewRow = ({ label, value }: OverviewRowProps) => (
  <div className="flex items-center justify-between py-2 border-b border-card-border last:border-0">
    <span className="font-satoshi text-sm font-medium text-text-secondary">{label}</span>
    <span className="font-satoshi text-sm text-text-primary text-right max-w-[60%] truncate">
      {value || '-'}
    </span>
  </div>
);

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
  if (estimate > 0) return `$ ${estimate.toFixed(2)}`;
  if (cost > 0) return `$ ${cost.toFixed(2)}`;
  return '-';
};

const getActiveRoomUnits = (
  roomId: string | undefined,
  roomUnitsById: ReturnType<typeof useOrganisationRoomStore.getState>['roomUnitsById'],
  roomUnitIdsByRoomId: ReturnType<typeof useOrganisationRoomStore.getState>['roomUnitIdsByRoomId']
) =>
  (roomUnitIdsByRoomId[roomId ?? ''] ?? []).flatMap((unitId) => {
    const unit = roomUnitsById[unitId];
    return unit && unit.isActive !== false ? [unit] : [];
  });

const getFirstRoomUnitId = (
  roomId: string | undefined,
  roomUnitsById: ReturnType<typeof useOrganisationRoomStore.getState>['roomUnitsById'],
  roomUnitIdsByRoomId: ReturnType<typeof useOrganisationRoomStore.getState>['roomUnitIdsByRoomId']
) => getActiveRoomUnits(roomId, roomUnitsById, roomUnitIdsByRoomId)[0]?.id;

type RoomSelectorSectionProps = {
  label: string;
  savingRoom: boolean;
  canEditRoom: boolean;
  options: Array<{ label: string; value: string }>;
  defaultOption: string;
  onSelect: (option: { label: string; value: string }) => void;
  fallback: string;
};

const RoomSelectorSection = ({
  label,
  savingRoom,
  canEditRoom,
  options,
  defaultOption,
  onSelect,
  fallback,
}: RoomSelectorSectionProps) => (
  <div className="relative">
    <span
      className="pointer-events-none absolute left-4 top-0 z-10 flex -translate-y-1/2 items-center gap-1 bg-white px-1 font-satoshi text-sm leading-none"
      style={{ color: 'var(--color-input-text-placeholder)' }}
    >
      {label}
    </span>
    {canEditRoom ? (
      <LabelDropdown
        placeholder={savingRoom ? 'Saving…' : `Select ${label.toLowerCase()}`}
        options={options}
        defaultOption={defaultOption}
        onSelect={onSelect}
        searchable={false}
      />
    ) : (
      <div className="border border-input-border-default rounded-2xl px-4 py-3 min-h-12 font-satoshi text-base text-text-primary">
        {fallback}
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
  const { notify } = useNotify();
  const rooms = useRoomsForPrimaryOrg();
  const roomUnitsById = useOrganisationRoomStore((s) => s.roomUnitsById);
  const roomUnitIdsByRoomId = useOrganisationRoomStore((s) => s.roomUnitIdsByRoomId);
  const invoices = useInvoicesForPrimaryOrg();
  const orgsById = useOrgStore((s) => s.orgsById);
  const getServicesBySpecialityId = useServiceStore.getState().getServicesBySpecialityId;
  const initEncounter = useAppointmentWorkspaceStore((s) => s.initEncounter);
  const setRoomUnit = useAppointmentWorkspaceStore((s) => s.setRoomUnit);
  const encounter = useAppointmentWorkspaceStore((s) =>
    activeAppointment.id ? s.encountersById[activeAppointment.id] : undefined
  );

  const [savingRoom, setSavingRoom] = useState(false);
  const companion = getAppointmentCompanion(activeAppointment);
  const isInpatient = activeAppointment.appointmentKind === 'INPATIENT';

  const orgType =
    (activeAppointment.organisationId && orgsById[activeAppointment.organisationId]?.type) ||
    'HOSPITAL';

  const clinicalNotesIntent = getClinicalNotesIntent(orgType);
  const isUpcoming = activeAppointment.status === 'UPCOMING';
  const canOpenWorkspace = canEnterAppointmentWorkspace(activeAppointment.status);
  const canEditRoom = canAssignAppointmentRoom(activeAppointment.status);

  const invoicesByAppointmentId = useMemo(() => createInvoiceByAppointmentId(invoices), [invoices]);

  const effectiveRoomId = encounter?.roomId ?? activeAppointment.room?.id;
  const effectiveUnitId =
    encounter?.unitId ?? getFirstRoomUnitId(effectiveRoomId, roomUnitsById, roomUnitIdsByRoomId);
  const roomOptions = useMemo(() => rooms.map((r) => ({ label: r.name, value: r.id })), [rooms]);
  const unitOptions = useMemo(
    () =>
      getActiveRoomUnits(effectiveRoomId, roomUnitsById, roomUnitIdsByRoomId).map((unit) => ({
        label: unit.displayName || unit.code,
        value: unit.id,
      })),
    [effectiveRoomId, roomUnitIdsByRoomId, roomUnitsById]
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
      setSavingRoom(true);
      try {
        const foundRoom = rooms.find((r) => r.id === option.value);
        const nextUnitId = isInpatient
          ? getFirstRoomUnitId(option.value, roomUnitsById, roomUnitIdsByRoomId)
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
          }
        }
      } catch {
        notify('error', { title: 'Room update failed', text: 'Please try again.' });
      } finally {
        setSavingRoom(false);
      }
    },
    [
      activeAppointment,
      canEditRoom,
      initEncounter,
      isInpatient,
      notify,
      roomUnitIdsByRoomId,
      roomUnitsById,
      rooms,
      setRoomUnit,
    ]
  );

  const handleUnitChange = useCallback(
    async (option: { label: string; value: string }) => {
      if (!canEditRoom || !isInpatient || !activeAppointment.id) return;
      setSavingRoom(true);
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
        }
      } catch {
        notify('error', { title: 'Unit update failed', text: 'Please try again.' });
      } finally {
        setSavingRoom(false);
      }
    },
    [
      activeAppointment.encounterId,
      activeAppointment.id,
      activeAppointment.lead?.id,
      activeAppointment.lead?.name,
      canEditRoom,
      effectiveRoomId,
      initEncounter,
      isInpatient,
      notify,
      setRoomUnit,
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
      title="Appointment Details"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-4">
          {/* Patient */}
          <div className="flex items-center gap-3 p-3 rounded-2xl border border-card-border">
            <AppointmentAvatar
              name={companion.name}
              photoUrl={(companion as Appointment['patient'] & { photoUrl?: string }).photoUrl}
            />
            <div className="min-w-0">
              <div className="text-sm text-text-extra">Patient</div>
              <div className="font-satoshi text-base text-text-primary truncate">
                {companion.name || '-'}
              </div>
            </div>
          </div>

          {/* Client */}
          {companion.parent?.name && (
            <div className="flex items-center gap-3 p-3 rounded-2xl border border-card-border">
              <AppointmentAvatar name={companion.parent.name} />
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
              <AppointmentAvatar
                name={activeAppointment.lead.name ?? ''}
                photoUrl={activeAppointment.lead.profileUrl}
              />
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

        {/* ── RIGHT COLUMN ── */}
        <div className="flex flex-col gap-4">
          {/* Appointment detail rows */}
          <div className="rounded-2xl border border-card-border px-4 py-2">
            <div className="flex items-center justify-between py-2 border-b border-card-border">
              <span className="font-satoshi text-sm font-medium text-text-secondary">Status</span>
              <AppointmentStatusPill
                appointment={activeAppointment}
                canEdit={canEditAppointments}
              />
            </div>
            <OverviewRow
              label="Speciality"
              value={activeAppointment.appointmentType?.speciality?.name}
            />
            <OverviewRow label="Service" value={activeAppointment.appointmentType?.name} />
            <OverviewRow label="Chief Complaint" value={activeAppointment.concern} />
            <OverviewRow label="Emergency" value={activeAppointment.isEmergency ? 'Yes' : 'No'} />
          </div>

          {/* Room */}
          <RoomSelectorSection
            label="Room"
            savingRoom={savingRoom}
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
              savingRoom={savingRoom}
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
                    <span className="font-satoshi text-sm font-medium text-text-secondary">
                      Cost:
                    </span>
                    <span className="font-satoshi text-sm font-bold text-text-primary">
                      {serviceInfo.cost ? `$ ${Number(serviceInfo.cost).toFixed(2)}` : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-satoshi text-sm font-medium text-text-secondary">
                      Max discount:
                    </span>
                    <span className="font-satoshi text-sm font-bold text-text-primary">
                      {serviceInfo.maxDiscount
                        ? `$${Number(serviceInfo.maxDiscount).toFixed(2)}`
                        : '-'}
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
                      estimateDisplay === '-'
                        ? 'var(--color-neutral-500)'
                        : 'var(--color-primary-600)',
                    letterSpacing: '-0.48px',
                  }}
                >
                  {estimateDisplay}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {!canOpenWorkspace && (
        <p className="mt-5 rounded-2xl border border-card-border bg-neutral-100 p-4 text-body-4 text-text-secondary">
          {getWorkspaceBlockedMessage(activeAppointment.status)}
        </p>
      )}

      {/* Footer */}
      <div className="flex justify-end mt-6 pt-4 border-t border-card-border">
        <Primary
          text={isUpcoming ? 'Start Appointment' : 'View Details'}
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
