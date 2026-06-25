'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Appointment } from '@yosemite-crew/types';
import { LuBedSingle, LuCheckCircle } from 'react-icons/lu';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useAuthStore } from '@/app/stores/authStore';
import {
  buildWorkspaceHref,
  getNextStep,
  isPastLockWindow,
  resolveEncounterMode,
  resolveLandingStep,
} from '@/app/lib/appointmentWorkspace';
import { startRouteLoader } from '@/app/lib/routeLoader';
import {
  WORKSPACE_STEPS,
  type AppointmentEncounter,
  type CompanionAlert,
  type SoapNoteEntry,
  type WorkspaceStep,
} from '@/app/features/appointments/types/workspace';
import { isRichTextEmpty } from '@/app/lib/richText';
import { resolveLockHours } from '@/app/lib/appointmentLockWindow';
import { getAppointmentCompanion, normalizeAppointmentStatus } from '@/app/lib/appointments';
import { useAppointmentLockWindow } from '@/app/hooks/useAppointmentLockWindow';
import { useLoadRoomsForPrimaryOrg, useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import { useLoadCompanionsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useParentStore } from '@/app/stores/parentStore';
import { updateCompanion } from '@/app/features/companions/services/companionService';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { buildCompanionDetails } from '@/app/lib/companionWorkspaceDetails';
import { buildAppointmentCompanionHistoryHref } from '@/app/lib/companionHistoryRoute';
import {
  companionAlertsToStoredAlerts,
  storedAlertsToCompanionAlerts,
} from '@/app/features/appointments/lib/alertMapping';
import WorkspaceHeader from '@/app/features/appointments/pages/AppointmentWorkspace/WorkspaceHeader';
import AddAlertModal from '@/app/features/appointments/pages/AppointmentWorkspace/components/AddAlertModal';
import CompanionContextCard from '@/app/features/appointments/pages/AppointmentWorkspace/CompanionContextCard';
import WorkspaceStepper from '@/app/features/appointments/pages/AppointmentWorkspace/WorkspaceStepper';
import WorkspaceMetaBar from '@/app/features/appointments/pages/AppointmentWorkspace/WorkspaceMetaBar';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import Datepicker from '@/app/ui/inputs/Datepicker';
import Timepicker from '@/app/ui/inputs/Timepicker';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import SoapStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/SoapStep';
import DiagnosticsStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/DiagnosticsStep';
import TreatmentStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/TreatmentStep';
import InvoiceStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/InvoiceStep';
import SummaryStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/SummaryStep';
import QuickActionsModal from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/QuickActionsModal';
import HospitalizationModal from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/HospitalizationModal';
import {
  admitAppointment,
  assignEncounterUnit,
  changeAppointmentStatus,
  dischargeEncounter,
  markEncounterReadyForDischarge,
  undoEncounterReadyForDischarge,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { loadWorkspaceClinicalArtifacts } from '@/app/features/appointments/services/workspaceClinicalService';
import {
  listSoapTemplatesForWorkspace,
  resolveSoapTemplate,
} from '@/app/features/appointments/services/workspaceTemplateService';
import {
  getAppointmentWorkspaceBootstrap,
  normalizeWorkspaceBootstrapForEncounter,
} from '@/app/features/appointments/services/workspaceAggregateService';
import { markAppointmentReadyForBilling } from '@/app/features/billing/services/invoiceService';
import { useNotify } from '@/app/hooks/useNotify';

type AppointmentWorkspaceProps = {
  appointment: Appointment;
};

type WorkspaceRoom = {
  id: string;
  name: string;
};

const getRoomUnits = (
  roomId: string | undefined,
  roomUnitsById: ReturnType<typeof useOrganisationRoomStore.getState>['roomUnitsById'],
  roomUnitIdsByRoomId: ReturnType<typeof useOrganisationRoomStore.getState>['roomUnitIdsByRoomId']
) => {
  if (!roomId) return [];
  return (roomUnitIdsByRoomId[roomId] ?? [])
    .map((unitId) => roomUnitsById[unitId])
    .filter((unit) => unit?.isActive !== false);
};

const isValidStep = (value: string | null): value is WorkspaceStep =>
  value != null && (WORKSPACE_STEPS as string[]).includes(value);

const resolveAppointmentReason = (appointment: Appointment): string =>
  appointment.concern?.trim() || 'No appointment reason recorded.';

const getErrorStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object' || !('response' in error)) return undefined;
  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : undefined;
};

const getErrorMessage = (error: unknown): string => {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return error instanceof Error ? error.message : '';
  }
  const data = (error as { response?: { data?: unknown } }).response?.data;
  if (!data || typeof data !== 'object') return '';
  const message = (data as { message?: unknown; error?: { message?: unknown } }).message;
  const nestedMessage = (data as { error?: { message?: unknown } }).error?.message;
  if (typeof message === 'string') return message;
  if (typeof nestedMessage === 'string') return nestedMessage;
  return '';
};

const getWorkspaceBootstrapEncounterId = (bootstrap: unknown): string | undefined => {
  if (!bootstrap || typeof bootstrap !== 'object') return undefined;
  const encounter = (bootstrap as { encounter?: unknown }).encounter;
  if (!encounter || typeof encounter !== 'object') return undefined;
  const id = (encounter as { id?: unknown }).id;
  return typeof id === 'string' && id.trim() ? id.trim() : undefined;
};

const getRoomName = (rooms: WorkspaceRoom[], roomId?: string) =>
  rooms.find((room) => room.id === roomId)?.name ?? roomId ?? '';

const buildAdmissionDateTime = (date: Date | null, time: string): string => {
  const next = date ? new Date(date) : new Date();
  const [hours = '0', minutes = '0'] = time.split(':');
  next.setHours(Number.parseInt(hours, 10) || 0, Number.parseInt(minutes, 10) || 0, 0, 0);
  return next.toISOString();
};

const toTimeString = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const calculateExpectedStayDays = (start: Date | null, end: Date | null): number | undefined => {
  if (!start || !end) return undefined;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return undefined;
  return Math.max(1, Math.ceil(diffMs / 86_400_000));
};

const getSummaryTerminalLabel = ({
  isInpatient,
  alreadyDischarged,
}: {
  isInpatient: boolean;
  alreadyDischarged: boolean;
}): string => {
  if (isInpatient) {
    if (alreadyDischarged) return 'Discharged';
    return 'Discharge';
  }
  return alreadyDischarged ? 'Completed' : 'Complete';
};

type DischargeDateTimeModalProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  dischargeDate: Date | null;
  setDischargeDate: React.Dispatch<React.SetStateAction<Date | null>>;
  dischargeTime: string;
  setDischargeTime: (next: string) => void;
  onConfirm: () => void;
  isSaving: boolean;
  /** Backend-owned discharge readiness; when disabled, an override reason is required. */
  gate?: NonNullable<AppointmentEncounter['finalizationGate']>;
  overrideReason: string;
  setOverrideReason: (next: string) => void;
};

// A SOAP note carries real content if it is completed or any of its rich-text
// sections is non-empty. Hoisted to module scope to keep the hydration effect flat.
const hasMeaningfulSoapContent = (notes: SoapNoteEntry[]): boolean =>
  notes.some(
    (note) =>
      note.status === 'COMPLETED' ||
      ![note.chiefComplaint, note.subjective, note.objective, note.assessment, note.plan].every(
        (value) => isRichTextEmpty(value)
      )
  );

const DischargeDateTimeModal = ({
  showModal,
  setShowModal,
  dischargeDate,
  setDischargeDate,
  dischargeTime,
  setDischargeTime,
  onConfirm,
  isSaving,
  gate,
  overrideReason,
  setOverrideReason,
}: DischargeDateTimeModalProps) => {
  const handleCancel = () => {
    if (isSaving) return;
    setShowModal(false);
  };

  // When the backend gate blocks discharge, the clinician must give an override
  // reason before confirming — this is the audited, exceptional discharge path.
  const gateBlocked = gate ? gate.enabled === false : false;
  const overrideMissing = gateBlocked && !overrideReason.trim();
  const confirmLabel = (() => {
    if (isSaving) return 'Discharging...';
    return gateBlocked ? 'Override & discharge' : 'Confirm discharge';
  })();

  return (
    <CenterModal showModal={showModal} setShowModal={setShowModal} onClose={handleCancel}>
      <div className="flex w-full flex-col gap-4">
        <ModalHeader title="Discharge date & time" onClose={handleCancel} />
        {gateBlocked && (
          <div className="flex flex-col gap-2 rounded-2xl bg-danger-100 p-3">
            <p className="text-body-4 text-danger-700">
              {gate?.disabledReason ?? 'This encounter is not ready for discharge.'}
            </p>
            <label className="flex flex-col gap-1 text-caption-2 text-text-secondary">
              {'Override reason (required)'}
              <textarea
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                rows={2}
                className="rounded-xl border border-input-border-default px-3 py-2 text-body-4 text-text-primary"
                placeholder="Explain why discharge proceeds despite the open requirements"
              />
            </label>
          </div>
        )}
        <div className={`${isSaving ? 'pointer-events-none opacity-60' : ''} flex flex-col gap-3`}>
          <Datepicker
            type="input"
            currentDate={dischargeDate}
            setCurrentDate={setDischargeDate}
            placeholder="Discharge date"
          />
          <Timepicker value={dischargeTime} onChange={setDischargeTime} label="Discharge time" />
        </div>
        <div className="flex w-full flex-wrap items-center justify-center gap-2 pb-3">
          <Secondary
            href="#"
            text="Cancel"
            onClick={handleCancel}
            isDisabled={isSaving}
            className="w-auto min-w-30"
          />
          <Primary
            href="#"
            text={confirmLabel}
            onClick={onConfirm}
            isDisabled={isSaving || overrideMissing}
            className="w-auto min-w-36"
          />
        </div>
      </div>
    </CenterModal>
  );
};

/**
 * Full-page clinical workspace shell. Hosts the header, companion card, stepper,
 * meta bar, and the active step. Step bodies are layered in per phase.
 */
const AppointmentWorkspace = ({ appointment }: AppointmentWorkspaceProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notify } = useNotify();
  const attributes = useAuthStore((s) => s.attributes);
  useLoadRoomsForPrimaryOrg();
  useLoadCompanionsForPrimaryOrg();
  const rooms = useRoomsForPrimaryOrg();
  const roomUnitsById = useOrganisationRoomStore((s) => s.roomUnitsById);
  const roomUnitIdsByRoomId = useOrganisationRoomStore((s) => s.roomUnitIdsByRoomId);
  const catalogSpecialities = useRevampCatalogStore((s) => s.specialities);
  const catalogServices = useRevampCatalogStore((s) => s.services);
  const catalogPackages = useRevampCatalogStore((s) => s.packages);
  const loadOrganisationCatalog = useRevampCatalogStore((s) => s.loadOrganisationCatalog);
  const loadSpecialityCatalog = useRevampCatalogStore((s) => s.loadSpecialityCatalog);
  const companion = getAppointmentCompanion(appointment);
  const companionRecord = useCompanionStore((s) => s.companionsById[companion.id]);

  const appointmentId = appointment.id ?? '';
  const initialMode = useMemo(() => resolveEncounterMode(appointment), [appointment]);
  const appointmentReason = useMemo(() => resolveAppointmentReason(appointment), [appointment]);
  const actor = useMemo(() => {
    const first = attributes?.given_name ?? '';
    const last = attributes?.family_name ?? '';
    const name = `${first} ${last}`.trim();
    return { id: attributes?.sub, name: name || 'You' };
  }, [attributes]);

  const initEncounter = useAppointmentWorkspaceStore((s) => s.initEncounter);
  const encounter = useAppointmentWorkspaceStore((s) => s.encountersById[appointmentId]);
  const mergeEncounterData = useAppointmentWorkspaceStore((s) => s.mergeEncounterData);
  const applySoapTemplate = useAppointmentWorkspaceStore((s) => s.applySoapTemplate);
  const getEncounter = useAppointmentWorkspaceStore((s) => s.getEncounter);
  const activeStep = useAppointmentWorkspaceStore((s) => s.activeStep);
  const setActiveStep = useAppointmentWorkspaceStore((s) => s.setActiveStep);
  const activeSideAction = useAppointmentWorkspaceStore((s) => s.activeSideAction);
  const setActiveSideAction = useAppointmentWorkspaceStore((s) => s.setActiveSideAction);
  const setEncounterMode = useAppointmentWorkspaceStore((s) => s.setEncounterMode);
  const setRoomUnit = useAppointmentWorkspaceStore((s) => s.setRoomUnit);
  const addLineItem = useAppointmentWorkspaceStore((s) => s.addLineItem);
  const toggleReadyForBilling = useAppointmentWorkspaceStore((s) => s.toggleReadyForBilling);
  const toggleReadyForDischarge = useAppointmentWorkspaceStore((s) => s.toggleReadyForDischarge);
  const markDischarged = useAppointmentWorkspaceStore((s) => s.markDischarged);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isAddAlertOpen, setIsAddAlertOpen] = useState(false);
  const [isHospitalizeOpen, setIsHospitalizeOpen] = useState(false);
  const [isAdmitting, setIsAdmitting] = useState(false);
  const [isSummaryDischargeModalOpen, setIsSummaryDischargeModalOpen] = useState(false);
  const [summaryDischargeDate, setSummaryDischargeDate] = useState<Date | null>(() => new Date());
  const [summaryDischargeTime, setSummaryDischargeTime] = useState<string>(() =>
    toTimeString(new Date())
  );
  const [dischargeOverrideReason, setDischargeOverrideReason] = useState('');
  const lifecycleEncounterIdRef = useRef<string | undefined>(appointment.encounterId);
  const supportStaffMember = useMemo(() => {
    const leadName = (appointment.lead?.name ?? '').trim();
    return (appointment.supportStaff ?? []).find(
      (staff) => (staff.name ?? '').trim() && staff.name?.trim() !== leadName
    );
  }, [appointment.lead?.name, appointment.supportStaff]);

  useEffect(() => {
    if (!appointmentId) return;
    lifecycleEncounterIdRef.current = appointment.encounterId;
    const leadName = (appointment.lead?.name ?? '').trim();
    initEncounter(appointmentId, initialMode, {
      leadId: appointment.lead?.id,
      leadName,
      nurseId: supportStaffMember?.id,
      nurseName: supportStaffMember?.name?.trim(),
    });
  }, [
    appointment.encounterId,
    appointment.lead,
    appointmentId,
    initEncounter,
    initialMode,
    supportStaffMember,
  ]);

  useEffect(() => {
    const organisationId = appointment.organisationId;
    if (!organisationId) return;
    loadOrganisationCatalog(organisationId).catch((error: unknown) => {
      console.error('Failed to load hospitalization catalog:', error);
    });
  }, [appointment.organisationId, loadOrganisationCatalog]);

  useEffect(() => {
    const organisationId = appointment.organisationId;
    if (!organisationId || catalogSpecialities.length === 0) return;
    Promise.allSettled(
      catalogSpecialities
        .filter((speciality) => speciality.organisationId === organisationId)
        .map((speciality) => loadSpecialityCatalog(organisationId, speciality.id))
    ).catch((error: unknown) => {
      console.error('Failed to load hospitalization services:', error);
    });
  }, [appointment.organisationId, catalogSpecialities, loadSpecialityCatalog]);

  const hydratedClinicalRef = useRef<string | null>(null);
  useEffect(() => {
    const organisationId = appointment.organisationId;
    if (!appointmentId || !organisationId || !encounter) return;
    const hydrationKey = `${organisationId}:${appointmentId}:${appointment.encounterId ?? ''}`;
    if (hydratedClinicalRef.current === hydrationKey) return;
    hydratedClinicalRef.current = hydrationKey;

    Promise.allSettled([
      getAppointmentWorkspaceBootstrap(organisationId, appointmentId),
      loadWorkspaceClinicalArtifacts({
        organisationId,
        appointmentId,
        encounterId: appointment.encounterId,
        authorId: actor.id,
        authorName: actor.name,
      }),
      listSoapTemplatesForWorkspace(organisationId),
      // Resolve the service/package/species-linked SOAP template so the active
      // draft prefills before YC defaults. 404 → null (no default) so it no-ops.
      resolveSoapTemplate({
        organisationId,
        appointmentId,
        encounterId: appointment.encounterId,
        companionId: companion.id,
        species: companion.species,
        serviceId: appointment.appointmentType?.id,
        mode: encounter.mode === 'INPATIENT' ? 'INPATIENT' : 'OUTPATIENT',
      }),
    ])
      .then(([aggregateResult, clinicalResult, templatesResult, resolvedSoapResult]) => {
        if (aggregateResult.status === 'fulfilled') {
          lifecycleEncounterIdRef.current =
            getWorkspaceBootstrapEncounterId(aggregateResult.value) ??
            lifecycleEncounterIdRef.current;
        }
        mergeEncounterData(appointmentId, {
          ...(aggregateResult.status === 'fulfilled'
            ? normalizeWorkspaceBootstrapForEncounter(aggregateResult.value)
            : {}),
          ...(clinicalResult.status === 'fulfilled' ? clinicalResult.value : {}),
          soapTemplates: templatesResult.status === 'fulfilled' ? templatesResult.value : [],
        });
        // Prefill the active SOAP draft from the resolved template only when there
        // is no saved/typed SOAP content yet, so we never overwrite a real record.
        const resolvedSoap =
          resolvedSoapResult.status === 'fulfilled' ? resolvedSoapResult.value : null;
        const liveEncounter = getEncounter(appointmentId);
        const hasSoapContent = hasMeaningfulSoapContent(liveEncounter?.soap ?? []);
        if (resolvedSoap && !hasSoapContent) {
          applySoapTemplate(appointmentId, resolvedSoap);
        }
      })
      .catch((error) => {
        console.error('Unable to hydrate workspace data:', error);
      });
  }, [
    appointment.encounterId,
    appointment.organisationId,
    appointment.appointmentType?.id,
    appointmentId,
    actor.id,
    actor.name,
    companion.id,
    companion.species,
    encounter,
    mergeEncounterData,
    applySoapTemplate,
    getEncounter,
  ]);

  const encounterMode = encounter?.mode ?? initialMode;
  const lockWindow = useAppointmentLockWindow();

  const lockedByWindow = useMemo(
    () =>
      isPastLockWindow(
        appointment.startTime,
        encounterMode,
        Date.now(),
        resolveLockHours(encounterMode, lockWindow)
      ),
    [appointment.startTime, encounterMode, lockWindow]
  );

  // Land on the step from the URL, else the status-driven landing step — once
  // per appointment. A ref guards against re-running when the encounter mutates.
  const landedForRef = useRef<string | null>(null);
  const stepParam = searchParams.get('step');
  useEffect(() => {
    if (!encounter || landedForRef.current === encounter.appointmentId) return;
    landedForRef.current = encounter.appointmentId;
    const landingEncounter = {
      ...encounter,
      viewOnly: encounter.viewOnly || encounter.readyForDischarge.value || lockedByWindow,
    };
    setActiveStep(isValidStep(stepParam) ? stepParam : resolveLandingStep(landingEncounter));
  }, [encounter, lockedByWindow, stepParam, setActiveStep]);

  const companionDetails = useMemo(
    () =>
      buildCompanionDetails(
        {
          id: companion.id,
          name: companion.name,
          species: companion.species,
          breed: companion.breed,
        },
        companionRecord
      ),
    [companion, companionRecord]
  );
  // Clinical encounter — the time-based "Appointment lock window" freezes the
  // legal record (SOAP + Discharge/Summary). This is what the lock exists for.
  const effectiveEncounter = useMemo(
    () =>
      encounter
        ? {
            ...encounter,
            viewOnly: encounter.viewOnly || encounter.readyForDischarge.value || lockedByWindow,
          }
        : undefined,
    [encounter, lockedByWindow]
  );
  const persistedPatientAlerts = useMemo(
    () => storedAlertsToCompanionAlerts(companionRecord?.alerts, 'patient-alert'),
    [companionRecord?.alerts]
  );
  const displayedPatientAlerts = persistedPatientAlerts.length
    ? persistedPatientAlerts
    : (effectiveEncounter?.alerts ?? []);
  // Client (parent) alerts: surfaced read-only alongside the patient alerts so
  // the same alert state is visible in the workspace, not only the companion modal.
  const parentRecord = useParentStore((s) => s.parentsById[companion.parent.id]);
  const displayedClientAlerts = useMemo(
    () => storedAlertsToCompanionAlerts(parentRecord?.alerts, 'client-alert'),
    [parentRecord?.alerts]
  );
  // Operational encounter — billing (Invoice, Services & Packages) and lab
  // orders (Diagnostics) are NOT frozen by the clinical time window. Industry
  // standard gates these on their own state (invoice finalized/paid,
  // readyForBilling, order/result status), not on a wall-clock timer.
  const operationalEncounter = useMemo(
    () =>
      encounter
        ? {
            ...encounter,
            viewOnly: encounter.viewOnly || encounter.readyForDischarge.value,
          }
        : undefined,
    [encounter]
  );
  const isCompletedAppointment = normalizeAppointmentStatus(appointment.status) === 'COMPLETED';

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === effectiveEncounter?.roomId),
    [effectiveEncounter?.roomId, rooms]
  );
  const selectedRoomUnits = useMemo(
    () => getRoomUnits(selectedRoom?.id, roomUnitsById, roomUnitIdsByRoomId),
    [roomUnitIdsByRoomId, roomUnitsById, selectedRoom?.id]
  );
  const roomOptions = useMemo(() => {
    if (rooms.length) return rooms.map((room) => ({ label: room.name, value: room.id }));
    return effectiveEncounter?.roomId
      ? [{ label: 'Room 1', value: effectiveEncounter.roomId }]
      : [];
  }, [effectiveEncounter?.roomId, rooms]);
  const unitOptions = useMemo(() => {
    if (selectedRoomUnits.length) {
      return selectedRoomUnits.map((unit) => ({
        label: unit.displayName || unit.code,
        value: unit.id,
      }));
    }
    return effectiveEncounter?.unitId
      ? [{ label: effectiveEncounter.unitId, value: effectiveEncounter.unitId }]
      : [];
  }, [effectiveEncounter?.unitId, selectedRoomUnits]);
  const hasAdmission = Boolean(effectiveEncounter?.admittedAt);
  const supportOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { label: string; value: string }[] = [];
    const add = (name?: string) => {
      const trimmed = (name ?? '').trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      options.push({ label: trimmed, value: trimmed });
    };
    add(appointment.lead?.name);
    (appointment.supportStaff ?? []).forEach((staff) => add(staff.name));
    return options;
  }, [appointment.lead?.name, appointment.supportStaff]);
  const hospitalizationServicePackages = useMemo(() => {
    const serviceOptions = catalogServices
      .filter(
        (service) =>
          service.organisationId === appointment.organisationId &&
          service.status === 'ACTIVE' &&
          service.isBookable !== false
      )
      .map((service) => ({
        id: service.id,
        kind: 'SERVICE' as const,
        name: service.name,
        cost: service.grossAmount,
        maxDiscount: service.maxDiscount,
      }));
    const packageOptions = catalogPackages
      .filter(
        (pkg) =>
          pkg.organisationId === appointment.organisationId &&
          pkg.status === 'ACTIVE' &&
          pkg.isBookable !== false
      )
      .map((pkg) => ({
        id: pkg.id,
        kind: 'PACKAGE' as const,
        name: pkg.name,
        cost: pkg.serverFinalAmount ?? 0,
        maxDiscount: pkg.additionalDiscount,
      }));
    return [...serviceOptions, ...packageOptions];
  }, [appointment.organisationId, catalogPackages, catalogServices]);

  const handleStepChange = useCallback(
    (step: WorkspaceStep) => {
      setActiveStep(step);
      router.replace(buildWorkspaceHref(appointmentId, step), { scroll: false });
    },
    [appointmentId, router, setActiveStep]
  );

  const handleSaveAndNext = useCallback(() => {
    const next = getNextStep(activeStep);
    if (next) handleStepChange(next);
  }, [activeStep, handleStepChange]);

  const refreshWorkspaceEncounterId = useCallback(async () => {
    const organisationId = appointment.organisationId;
    if (!organisationId || !appointmentId) return undefined;
    const bootstrap = await getAppointmentWorkspaceBootstrap(organisationId, appointmentId);
    const encounterId = getWorkspaceBootstrapEncounterId(bootstrap);
    if (encounterId) lifecycleEncounterIdRef.current = encounterId;
    mergeEncounterData(appointmentId, normalizeWorkspaceBootstrapForEncounter(bootstrap));
    return encounterId;
  }, [appointment.organisationId, appointmentId, mergeEncounterData]);

  const handleAdmit = useCallback(
    async (
      unitId?: string,
      roomId?: string,
      options?: {
        admittedAt?: string;
        expectedStayDays?: number;
        supportName?: string;
        allowModeConversion?: boolean;
      }
    ) => {
      if (isAdmitting) return false;
      if (encounterMode !== 'INPATIENT' && !options?.allowModeConversion) {
        notify('error', {
          title: 'Unable to admit',
          text: 'Only inpatient appointments can be admitted.',
        });
        return false;
      }

      const admittedAt = options?.admittedAt ?? new Date().toISOString();
      const resolvedRoomId = roomId ?? effectiveEncounter?.roomId ?? appointment.room?.id;
      const resolvedUnitId = unitId ?? effectiveEncounter?.unitId;
      const leadName = (effectiveEncounter?.leadName ?? appointment.lead?.name ?? '').trim();
      const leadId = effectiveEncounter?.leadId ?? appointment.lead?.id;
      const supportStaff: Array<{ id?: string; name?: string }> = (appointment.supportStaff ?? [])
        .map((staff) => ({
          id: staff.id,
          name: staff.name,
        }))
        .filter((staff) => staff.id || staff.name);
      if (
        options?.supportName &&
        !supportStaff.some((staff) => staff.name === options.supportName)
      ) {
        supportStaff.push({ name: options.supportName });
      }
      if (!supportStaff.length && (effectiveEncounter?.nurseId || effectiveEncounter?.nurseName)) {
        supportStaff.push({
          id: effectiveEncounter.nurseId,
          name: effectiveEncounter.nurseName,
        });
      }

      setIsAdmitting(true);
      try {
        await admitAppointment(appointment.organisationId, appointmentId, {
          admittedAt,
          expectedStayDays: options?.expectedStayDays,
          lead: leadId || leadName ? { id: leadId, name: leadName || undefined } : undefined,
          supportStaff,
          room: resolvedRoomId
            ? { id: resolvedRoomId, name: getRoomName(rooms, resolvedRoomId) }
            : undefined,
          roomUnitId: resolvedUnitId,
          assignedAt: admittedAt,
          assignedBy: actor.id ?? actor.name,
          assignmentReason: resolvedUnitId
            ? 'Initial inpatient placement'
            : 'Admitted from appointment workspace',
        });
        mergeEncounterData(appointmentId, {
          mode: 'INPATIENT',
          roomId: resolvedRoomId,
          unitId: resolvedUnitId,
          admittedAt,
        });
        if (resolvedRoomId || resolvedUnitId) {
          setRoomUnit(appointmentId, resolvedRoomId, resolvedUnitId);
        }
        refreshWorkspaceEncounterId().catch((error) => {
          console.error('Unable to refresh workspace after admission:', error);
        });
        notify('success', { title: 'Patient admitted', text: 'Admission has been created.' });
        return true;
      } catch (error) {
        notify('error', {
          title: 'Unable to admit',
          text: getErrorMessage(error) || 'Please try again.',
        });
        return false;
      } finally {
        setIsAdmitting(false);
      }
    },
    [
      actor.id,
      actor.name,
      appointment.lead?.id,
      appointment.lead?.name,
      appointment.organisationId,
      appointment.room?.id,
      appointment.supportStaff,
      appointmentId,
      effectiveEncounter?.leadId,
      effectiveEncounter?.leadName,
      effectiveEncounter?.nurseId,
      effectiveEncounter?.nurseName,
      effectiveEncounter?.roomId,
      effectiveEncounter?.unitId,
      encounterMode,
      isAdmitting,
      mergeEncounterData,
      notify,
      refreshWorkspaceEncounterId,
      rooms,
      setRoomUnit,
    ]
  );

  const persistUnitAssignment = useCallback(
    async (unitId?: string) => {
      const encounterId =
        lifecycleEncounterIdRef.current ??
        appointment.encounterId ??
        (await refreshWorkspaceEncounterId());
      if (!unitId) return false;
      if (!encounterId) {
        notify('error', {
          title: 'Unable to assign unit',
          text: 'This appointment does not have an encounter yet. Start or refresh the workspace and try again.',
        });
        return false;
      }
      try {
        await assignEncounterUnit({
          encounterId,
          unitId,
          assignedBy: actor.name,
          reason: 'Workspace room assignment',
        });
        return true;
      } catch (error) {
        const message = getErrorMessage(error);
        if (message.includes('Admission not found') && encounterMode === 'INPATIENT') {
          return handleAdmit(unitId, effectiveEncounter?.roomId ?? appointment.room?.id);
        }
        notify('error', {
          title: 'Unable to assign unit',
          text: message || 'Please try again.',
        });
        return false;
      }
    },
    [
      actor.name,
      appointment.encounterId,
      appointment.room?.id,
      effectiveEncounter?.roomId,
      encounterMode,
      handleAdmit,
      notify,
      refreshWorkspaceEncounterId,
    ]
  );

  const persistRoomAssignment = useCallback(
    async (roomId?: string) => {
      if (!roomId || appointment.room?.id === roomId) return;
      try {
        await updateAppointment({
          ...appointment,
          room: {
            id: roomId,
            name: getRoomName(rooms, roomId),
          },
        });
      } catch (error) {
        console.error('Unable to persist appointment room assignment:', error);
      }
    },
    [appointment, rooms]
  );

  const handleRoomSelect = useCallback(
    async (option: { value: string }) => {
      const firstUnit = getRoomUnits(option.value, roomUnitsById, roomUnitIdsByRoomId)[0]?.id;
      const nextUnit = encounterMode === 'INPATIENT' ? firstUnit : undefined;
      const previousRoomId = effectiveEncounter?.roomId;
      const previousUnitId = effectiveEncounter?.unitId;
      setRoomUnit(appointmentId, option.value, nextUnit);
      const [, unitPersisted] = await Promise.all([
        persistRoomAssignment(option.value),
        persistUnitAssignment(nextUnit),
      ]);
      if (nextUnit && !unitPersisted) {
        setRoomUnit(appointmentId, previousRoomId, previousUnitId);
      }
    },
    [
      appointmentId,
      encounterMode,
      effectiveEncounter?.roomId,
      effectiveEncounter?.unitId,
      persistRoomAssignment,
      persistUnitAssignment,
      roomUnitIdsByRoomId,
      roomUnitsById,
      setRoomUnit,
    ]
  );

  const handleUnitSelect = useCallback(
    async (option: { value: string }) => {
      const previousUnitId = effectiveEncounter?.unitId;
      setRoomUnit(appointmentId, effectiveEncounter?.roomId, option.value);
      const [, unitPersisted] = await Promise.all([
        persistRoomAssignment(effectiveEncounter?.roomId),
        persistUnitAssignment(option.value),
      ]);
      if (!unitPersisted) {
        setRoomUnit(appointmentId, effectiveEncounter?.roomId, previousUnitId);
      }
    },
    [
      appointmentId,
      effectiveEncounter?.roomId,
      effectiveEncounter?.unitId,
      persistRoomAssignment,
      persistUnitAssignment,
      setRoomUnit,
    ]
  );

  const runEncounterLifecycleOperation = useCallback(
    async (operation: (encounterId: string) => Promise<void>) => {
      const currentEncounterId = lifecycleEncounterIdRef.current ?? appointment.encounterId;
      if (!currentEncounterId) return;
      try {
        await operation(currentEncounterId);
      } catch (error) {
        if (getErrorStatus(error) !== 404) throw error;
        const freshEncounterId = await refreshWorkspaceEncounterId();
        if (!freshEncounterId || freshEncounterId === currentEncounterId) {
          // A 404 that survives an encounter-id refresh means the lifecycle
          // operation route is not available on this backend yet (the deployed
          // fork lags our API). Apply the toggle locally but surface that it
          // wasn't persisted so the gap is visible rather than silent.
          notify('warning', {
            title: 'Saved locally only',
            text: 'This action is not available on the server yet, so it was applied locally.',
          });
          return;
        }
        await operation(freshEncounterId);
      }
    },
    [appointment.encounterId, notify, refreshWorkspaceEncounterId]
  );

  const handleReadyForDischargeToggle = useCallback(async () => {
    const nextReady = !(encounter?.readyForDischarge.value ?? false);
    // The encounter id is hydrated asynchronously from the workspace bootstrap.
    // If it hasn't resolved yet, fetch it now so the toggle actually persists
    // instead of silently flipping only in local state.
    if (!(lifecycleEncounterIdRef.current ?? appointment.encounterId)) {
      await refreshWorkspaceEncounterId();
    }
    if (lifecycleEncounterIdRef.current ?? appointment.encounterId) {
      await runEncounterLifecycleOperation(
        nextReady ? markEncounterReadyForDischarge : undoEncounterReadyForDischarge
      );
    }
    toggleReadyForDischarge(appointmentId, actor);
  }, [
    actor,
    appointment.encounterId,
    appointmentId,
    encounter?.readyForDischarge.value,
    refreshWorkspaceEncounterId,
    runEncounterLifecycleOperation,
    toggleReadyForDischarge,
  ]);

  const handleReadyForBillingToggle = useCallback(async () => {
    const nextReady = !(encounter?.readyForBilling.value ?? false);
    // Marking ready persists by setting the invoice's visitBillingStage to
    // READY_FOR_BILLING on the finance service; the workspace bootstrap reads that
    // back on refresh. There is no server endpoint to revert the stage, so undoing
    // can only ever be local — surface that instead of silently diverging on reload.
    if (!nextReady) {
      notify('warning', {
        title: 'Can’t unmark on the server',
        text: 'Ready for billing can’t be reverted once set. It will stay marked after refresh.',
      });
      return;
    }
    try {
      await markAppointmentReadyForBilling(appointmentId, {
        organisationId: appointment.organisationId,
        patientId: companion.id,
        parentId: companion.parent.id,
        visitId: lifecycleEncounterIdRef.current ?? appointment.encounterId,
        notes: 'Ready for billing from appointment workspace',
      });
    } catch (error) {
      // Do NOT flip local state if the write failed — otherwise the UI shows
      // "ready" but a refresh reverts it, which reads as "not persisting".
      console.error('Failed to mark appointment ready for billing:', error);
      notify('error', {
        title: 'Couldn’t mark ready for billing',
        text: 'The change wasn’t saved. Please try again.',
      });
      return;
    }
    // Re-hydrate from the workspace bootstrap so the checkbox reflects confirmed
    // server state (invoice visitBillingStage). This is what persists across a
    // page refresh, so binding the UI to it — rather than only flipping local
    // state — guarantees the checkbox stays checked after reload.
    try {
      await refreshWorkspaceEncounterId();
    } catch (error) {
      console.error('Failed to refresh billing state after marking ready:', error);
      // Fall back to an optimistic flip so the user still sees their action.
      toggleReadyForBilling(appointmentId, actor);
    }
  }, [
    actor,
    appointment.encounterId,
    appointment.organisationId,
    appointmentId,
    companion.id,
    companion.parent.id,
    encounter?.readyForBilling.value,
    notify,
    refreshWorkspaceEncounterId,
    toggleReadyForBilling,
  ]);

  const persistPatientAlerts = useCallback(
    async (nextAlerts: CompanionAlert[]) => {
      if (!companionRecord) {
        notify('error', {
          title: 'Unable to update alerts',
          text: 'Patient details are still loading. Please try again.',
        });
        return;
      }
      await updateCompanion({
        ...companionRecord,
        alerts: companionAlertsToStoredAlerts(nextAlerts),
      });
    },
    [companionRecord, notify]
  );

  const handleAddPatientAlert = useCallback(
    async (alert: Omit<CompanionAlert, 'id'>) => {
      const nextAlerts = [
        ...persistedPatientAlerts,
        { ...alert, id: `patient-alert-${persistedPatientAlerts.length}` },
      ];
      try {
        await persistPatientAlerts(nextAlerts);
        notify('success', { title: 'Alert added', text: 'Patient alert has been saved.' });
      } catch {
        notify('error', { title: 'Failed to add alert', text: 'Please try again.' });
      }
    },
    [persistPatientAlerts, persistedPatientAlerts, notify]
  );

  const handleRemovePatientAlert = useCallback(
    async (id: string) => {
      const nextAlerts = persistedPatientAlerts.filter((alert) => alert.id !== id);
      try {
        await persistPatientAlerts(nextAlerts);
        notify('success', { title: 'Alert removed', text: 'Patient alert has been removed.' });
      } catch {
        notify('error', { title: 'Failed to remove alert', text: 'Please try again.' });
      }
    },
    [persistPatientAlerts, persistedPatientAlerts, notify]
  );

  useEffect(() => {
    if (!appointmentId || !encounter || encounter.roomId || !appointment.room?.id) return;
    const firstUnit = getRoomUnits(appointment.room.id, roomUnitsById, roomUnitIdsByRoomId)[0]?.id;
    setRoomUnit(
      appointmentId,
      appointment.room.id,
      encounter.mode === 'INPATIENT' ? firstUnit : undefined
    );
  }, [
    appointment.room?.id,
    appointmentId,
    encounter,
    roomUnitIdsByRoomId,
    roomUnitsById,
    setRoomUnit,
  ]);

  useEffect(() => {
    if (!appointmentId || !encounter?.unitId || encounter.roomId) return;
    const unitRoomId = roomUnitsById[encounter.unitId]?.roomId;
    if (!unitRoomId) return;
    setRoomUnit(appointmentId, unitRoomId, encounter.unitId);
  }, [appointmentId, encounter?.roomId, encounter?.unitId, roomUnitsById, setRoomUnit]);

  useEffect(() => {
    // Reset to the very top of the page on appointment/step change. The colored
    // header band uses a negative top margin, so scrollIntoView on the wrapper
    // lands a little below the true start — scroll the actual containers to 0.
    const mainContent = document.getElementById('main-content');
    mainContent?.scrollTo({ top: 0, behavior: 'auto' });
    globalThis.window?.scrollTo({ top: 0, behavior: 'auto' });
  }, [appointmentId, activeStep]);

  const treatmentPrimaryCta = useMemo(
    () =>
      activeStep === 'TREATMENT'
        ? { label: 'Skip to Summary', onClick: () => handleStepChange('SUMMARY') }
        : undefined,
    [activeStep, handleStepChange]
  );

  const completeAppointmentStatus = useCallback(async () => {
    if (isCompletedAppointment) return;
    await changeAppointmentStatus(appointment, 'COMPLETED');
  }, [appointment, isCompletedAppointment]);

  const handleDischarge = useCallback(
    async (dischargedAt: string, overrideReason?: string) => {
      if (isFinalizing) return;
      setIsFinalizing(true);
      try {
        await dischargeEncounter(
          lifecycleEncounterIdRef.current ?? appointment.encounterId,
          dischargedAt,
          { overrideReason }
        );
        await completeAppointmentStatus();
        markDischarged(appointmentId, dischargedAt);
        notify('success', {
          title: 'Patient discharged',
          text: 'The inpatient stay has been closed.',
        });
      } catch (error) {
        notify('error', {
          title: 'Unable to discharge',
          text: getErrorMessage(error) || 'Please try again.',
        });
      } finally {
        setIsFinalizing(false);
      }
    },
    [
      appointment.encounterId,
      appointmentId,
      completeAppointmentStatus,
      isFinalizing,
      markDischarged,
      notify,
    ]
  );

  const handleComplete = useCallback(async () => {
    if (isFinalizing) return;
    setIsFinalizing(true);
    try {
      await completeAppointmentStatus();
      markDischarged(appointmentId, new Date().toISOString());
      notify('success', {
        title: 'Appointment completed',
        text: 'The visit has been marked complete.',
      });
    } catch (error) {
      notify('error', {
        title: 'Unable to complete',
        text: getErrorMessage(error) || 'Please try again.',
      });
    } finally {
      setIsFinalizing(false);
    }
  }, [appointmentId, completeAppointmentStatus, isFinalizing, markDischarged, notify]);

  const handleSummaryTerminalAction = useCallback(() => {
    if (!effectiveEncounter) return;
    const alreadyDischarged = Boolean(effectiveEncounter.dischargedAt);
    if (alreadyDischarged || isFinalizing) return;
    if (effectiveEncounter.mode === 'INPATIENT') {
      setIsSummaryDischargeModalOpen(true);
      return;
    }
    void handleComplete();
  }, [effectiveEncounter, handleComplete, isFinalizing]);

  const handleConfirmSummaryDischarge = useCallback(() => {
    void handleDischarge(
      buildAdmissionDateTime(summaryDischargeDate, summaryDischargeTime),
      dischargeOverrideReason.trim() || undefined
    ).then(() => {
      setIsSummaryDischargeModalOpen(false);
      setDischargeOverrideReason('');
    });
  }, [dischargeOverrideReason, handleDischarge, summaryDischargeDate, summaryDischargeTime]);

  const summaryPrimaryCta = useMemo(() => {
    if (activeStep !== 'SUMMARY' || !effectiveEncounter) return undefined;
    const isInpatient = effectiveEncounter.mode === 'INPATIENT';
    const alreadyDischarged = Boolean(effectiveEncounter.dischargedAt);
    const label = getSummaryTerminalLabel({
      isInpatient,
      alreadyDischarged,
    });
    return {
      label,
      onClick: handleSummaryTerminalAction,
      isDisabled: alreadyDischarged || isFinalizing,
      icon: isInpatient ? <LuBedSingle aria-hidden="true" /> : <LuCheckCircle aria-hidden="true" />,
    };
  }, [activeStep, effectiveEncounter, handleSummaryTerminalAction, isFinalizing]);

  const workspacePrimaryCta = summaryPrimaryCta ?? treatmentPrimaryCta;

  if (!effectiveEncounter || !operationalEncounter) return null;

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div className="-mx-4 -mt-5 flex flex-col gap-5 bg-(--status-in-progress-bg) px-4 pt-5 pb-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <WorkspaceHeader
          appointment={appointment}
          companionName={companion.name}
          alerts={displayedPatientAlerts}
          clientAlerts={displayedClientAlerts}
          onBack={() => {
            startRouteLoader();
            router.push('/appointments');
          }}
          onQuickActions={() => setActiveSideAction('RECORD')}
          onHospitalize={() => setIsHospitalizeOpen(true)}
          canAdmit={encounterMode === 'INPATIENT' && !hasAdmission && !effectiveEncounter.viewOnly}
          isAdmitting={isAdmitting}
          onAdmit={() => handleAdmit(effectiveEncounter.unitId, effectiveEncounter.roomId)}
          canHospitalize={encounterMode !== 'INPATIENT'}
          onAddAlert={() => setIsAddAlertOpen(true)}
          onRemoveAlert={handleRemovePatientAlert}
        />

        <CompanionContextCard
          name={companion.name}
          photoUrl={companionRecord?.photoUrl}
          speciesType={companionRecord?.type ?? companion.species}
          details={companionDetails}
          mode={encounterMode}
          onViewDetails={() =>
            router.push(buildAppointmentCompanionHistoryHref(appointmentId, companion.id))
          }
        />

        <WorkspaceStepper
          activeStep={activeStep}
          stepStatus={effectiveEncounter.stepStatus}
          onStepChange={handleStepChange}
        />
      </div>

      <WorkspaceMetaBar
        encounter={effectiveEncounter}
        activeStep={activeStep}
        leadPhotoUrl={appointment.lead?.profileUrl}
        supportPhotoUrl={(supportStaffMember as { profileUrl?: string } | undefined)?.profileUrl}
        roomOptions={roomOptions}
        unitOptions={unitOptions}
        onSelectRoom={handleRoomSelect}
        onSelectUnit={handleUnitSelect}
        onSaveAndNext={handleSaveAndNext}
        onToggleReadyForBilling={handleReadyForBillingToggle}
        onToggleReadyForDischarge={handleReadyForDischargeToggle}
        billingTogglesLocked={encounter?.viewOnly ?? false}
        dischargeTogglesLocked={(encounter?.viewOnly ?? false) || lockedByWindow}
        primaryCta={workspacePrimaryCta}
      />

      <section aria-label="Workspace step content" className="min-h-50">
        {activeStep === 'SOAP' && (
          <SoapStep
            appointmentId={appointmentId}
            organisationId={appointment.organisationId}
            encounterId={appointment.encounterId}
            authorId={actor.id}
            authorName={actor.name}
            appointmentReason={appointmentReason}
            appointmentService={appointment.appointmentType?.name}
            appointmentSpeciality={appointment.appointmentType?.speciality?.name}
            encounter={effectiveEncounter}
            onRecordVitals={() => setActiveSideAction('RECORD')}
            onSaveAndNext={handleSaveAndNext}
          />
        )}
        {activeStep === 'DIAGNOSTICS' && (
          <DiagnosticsStep
            appointment={appointment}
            readOnly={operationalEncounter.viewOnly}
            onOpenTreatment={() => handleStepChange('TREATMENT')}
          />
        )}
        {activeStep === 'TREATMENT' && (
          <TreatmentStep
            appointmentId={appointmentId}
            organisationId={appointment.organisationId}
            encounterId={appointment.encounterId}
            authorId={actor.id}
            encounter={operationalEncounter}
            onOpenInvoice={() => handleStepChange('INVOICE')}
          />
        )}
        {activeStep === 'INVOICE' && (
          <InvoiceStep
            appointmentId={appointmentId}
            organisationId={appointment.organisationId}
            patientId={companion.id}
            parentId={companion.parent.id}
            encounter={operationalEncounter}
            hideBillBuilder={isCompletedAppointment}
            onOpenSummary={() => handleStepChange('SUMMARY')}
          />
        )}
        {activeStep === 'SUMMARY' && (
          <SummaryStep
            appointmentId={appointmentId}
            appointment={appointment}
            encounter={effectiveEncounter}
            resolvedEncounterId={lifecycleEncounterIdRef.current ?? appointment.encounterId}
          />
        )}
      </section>

      <DischargeDateTimeModal
        showModal={isSummaryDischargeModalOpen}
        setShowModal={setIsSummaryDischargeModalOpen}
        dischargeDate={summaryDischargeDate}
        setDischargeDate={setSummaryDischargeDate}
        dischargeTime={summaryDischargeTime}
        setDischargeTime={setSummaryDischargeTime}
        onConfirm={handleConfirmSummaryDischarge}
        isSaving={isFinalizing}
        gate={effectiveEncounter?.finalizationGate}
        overrideReason={dischargeOverrideReason}
        setOverrideReason={setDischargeOverrideReason}
      />

      <QuickActionsModal
        appointment={appointment}
        appointmentId={appointmentId}
        organisationId={appointment.organisationId}
        encounterId={appointment.encounterId}
        authorId={actor.id}
        activeAction={activeSideAction}
        onChangeAction={setActiveSideAction}
        onClose={() => setActiveSideAction(null)}
      />

      <AddAlertModal
        open={isAddAlertOpen}
        companionName={companion.name}
        onClose={() => setIsAddAlertOpen(false)}
        onAdd={handleAddPatientAlert}
      />

      <HospitalizationModal
        showModal={isHospitalizeOpen}
        setShowModal={setIsHospitalizeOpen}
        leadName={effectiveEncounter.leadName}
        supportName={effectiveEncounter.nurseName}
        supportOptions={supportOptions}
        roomOptions={roomOptions}
        unitOptions={unitOptions}
        servicePackages={hospitalizationServicePackages}
        defaultRoomId={effectiveEncounter.roomId}
        defaultUnitId={effectiveEncounter.unitId}
        onConvert={(payload) => {
          const selectedServicePackage = hospitalizationServicePackages.find(
            (item) => item.id === payload.servicePackageId
          );
          if (selectedServicePackage) {
            const amountCents = Math.max(0, Math.round(selectedServicePackage.cost * 100));
            addLineItem(appointmentId, {
              refId: selectedServicePackage.id,
              kind: selectedServicePackage.kind,
              name: selectedServicePackage.name,
              qty: 1,
              instructions: 'Added during hospitalization',
              unitPriceCents: amountCents,
              amountCents,
            });
          }
          setEncounterMode(appointmentId, 'INPATIENT');
          if (payload.roomId) {
            setRoomUnit(appointmentId, payload.roomId, payload.unitId);
            return handleAdmit(payload.unitId, payload.roomId, {
              admittedAt: buildAdmissionDateTime(payload.admissionDate, payload.admissionTime),
              expectedStayDays: calculateExpectedStayDays(
                payload.admissionDate,
                payload.dischargeDate
              ),
              supportName: payload.supportName,
              allowModeConversion: true,
            });
          }
          return handleAdmit(undefined, undefined, {
            admittedAt: buildAdmissionDateTime(payload.admissionDate, payload.admissionTime),
            expectedStayDays: calculateExpectedStayDays(
              payload.admissionDate,
              payload.dischargeDate
            ),
            supportName: payload.supportName,
            allowModeConversion: true,
          });
        }}
      />
    </div>
  );
};

export default AppointmentWorkspace;
