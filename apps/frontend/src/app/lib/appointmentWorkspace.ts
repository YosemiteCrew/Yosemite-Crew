import type { Appointment } from '@yosemite-crew/types';
import type {
  AppointmentEncounter,
  EncounterMode,
  SectionLock,
  StepStatus,
  WorkspaceLockSection,
  WorkspaceStep,
} from '@/app/features/appointments/types/workspace';
import type { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { WORKSPACE_STEPS } from '@/app/features/appointments/types/workspace';
import { normalizeAppointmentStatus, toStatusLabel } from '@/app/lib/appointments';
import { formatDateInPreferredTimeZone, getDateKeyInPreferredTimeZone } from '@/app/lib/timezone';

/** Default lock/edit window (hours) used until the org preference is wired. */
export const DEFAULT_OUTPATIENT_LOCK_HOURS = 24;
export const DEFAULT_INPATIENT_LOCK_HOURS = 24;

/** Build the workspace route for an appointment. */
export const buildWorkspaceHref = (appointmentId: string, step?: WorkspaceStep): string => {
  const base = `/appointments/${encodeURIComponent(appointmentId)}/workspace`;
  return step ? `${base}?step=${step}` : base;
};

export const resolveWorkspaceStepForIntent = (
  intent?: AppointmentViewIntent | null
): WorkspaceStep | undefined => {
  if (!intent) return undefined;
  if (intent.label === 'labs') return 'DIAGNOSTICS';
  if (intent.label === 'finance') return 'INVOICE';
  if (intent.label === 'prescription' || intent.label === 'care') return 'SOAP';
  if (intent.label === 'tasks') return 'TREATMENT';
  if (intent.label === 'info') return 'SUMMARY';
  return undefined;
};

export const buildWorkspaceHrefForIntent = (
  appointmentId: string,
  intent?: AppointmentViewIntent | null
): string => buildWorkspaceHref(appointmentId, resolveWorkspaceStepForIntent(intent));

/** Requested, cancelled, and no-show appointments never enter the clinical workspace. */
export const canEnterAppointmentWorkspace = (status?: string | null): boolean => {
  const normalized = normalizeAppointmentStatus(status);
  if (!normalized) return false;
  return normalized !== 'REQUESTED' && normalized !== 'CANCELLED' && normalized !== 'NO_SHOW';
};

export const getWorkspaceBlockedMessage = (status?: string | null): string => {
  const label = toStatusLabel(status).toLowerCase();
  if (label === 'unknown') return 'This appointment cannot be opened in the workspace.';
  return `${toStatusLabel(status)} appointments cannot be opened in the clinical workspace.`;
};

const INPATIENT_TEXT_PATTERN = /\b(inpatient|hospital|admission|admit|ward)\b/i;

/**
 * Derive the encounter mode used by the workspace from backend-owned booking
 * fields first. Room presence is only a fallback because a new inpatient
 * booking may not have a room or unit assigned yet.
 */
export const resolveEncounterMode = (
  appointment: Pick<Appointment, 'appointmentKind' | 'appointmentType' | 'room'>
): EncounterMode => {
  if (appointment.appointmentKind === 'INPATIENT') return 'INPATIENT';
  if (appointment.appointmentKind === 'OUTPATIENT') return 'OUTPATIENT';
  const appointmentTypeName = appointment.appointmentType?.name ?? '';
  if (INPATIENT_TEXT_PATTERN.test(appointmentTypeName)) return 'INPATIENT';
  return appointment.room?.id ? 'INPATIENT' : 'OUTPATIENT';
};

const isStepDone = (status: StepStatus | undefined): boolean => status === 'COMPLETED';

/**
 * Choose the step to land on when the workspace opens, driven by encounter progress.
 * All steps remain freely navigable regardless of the landing step.
 */
export const resolveLandingStep = (encounter: AppointmentEncounter): WorkspaceStep => {
  if (encounter.viewOnly) return 'SUMMARY';
  if (encounter.readyForDischarge.value) return 'SUMMARY';
  if (encounter.readyForBilling.value) return 'INVOICE';
  if (isStepDone(encounter.stepStatus.TREATMENT)) return 'INVOICE';
  if (isStepDone(encounter.stepStatus.DIAGNOSTICS)) return 'TREATMENT';
  if (isStepDone(encounter.stepStatus.SOAP)) return 'DIAGNOSTICS';
  return 'SOAP';
};

/** The next step after the given one, or null when on the last step. */
export const getNextStep = (step: WorkspaceStep): WorkspaceStep | null => {
  const index = WORKSPACE_STEPS.indexOf(step);
  if (index < 0 || index >= WORKSPACE_STEPS.length - 1) return null;
  return WORKSPACE_STEPS[index + 1];
};

/**
 * Whether the appointment is past its lock window and should be view-only.
 * `startTime` is the encounter start; `nowMs` defaults to the current time.
 */
export const isPastLockWindow = (
  startTime: Date | string | undefined,
  mode: EncounterMode,
  nowMs: number = Date.now(),
  overrideHours?: number
): boolean => {
  if (!startTime) return false;
  const startMs = new Date(startTime).getTime();
  if (Number.isNaN(startMs)) return false;
  const defaultHours =
    mode === 'INPATIENT' ? DEFAULT_INPATIENT_LOCK_HOURS : DEFAULT_OUTPATIENT_LOCK_HOURS;
  const hours =
    overrideHours != null && Number.isFinite(overrideHours) && overrideHours > 0
      ? overrideHours
      : defaultHours;
  return nowMs - startMs > hours * 60 * 60 * 1000;
};

/**
 * Resolve the effective lock for a workspace section. The backend section-lock is
 * authoritative when present (`encounter.sectionLocks[section]`); otherwise we fall
 * back to the client-derived `clientLocked` (e.g. `viewOnly` or the lock-window).
 * This lets every section consume backend-owned locks the moment the bootstrap
 * starts returning them, without changing behaviour while the contract is absent.
 */
export const resolveSectionLock = (
  encounter: Pick<AppointmentEncounter, 'sectionLocks'> | undefined,
  section: WorkspaceLockSection,
  clientLocked: boolean
): SectionLock => {
  const backendLock = encounter?.sectionLocks?.[section];
  if (backendLock) return backendLock;
  return { locked: clientLocked };
};

/**
 * Format the time portion of an ISO timestamp in the org's preferred time zone,
 * with the zone abbreviation, e.g. "10:45 PM IST".
 */
export const formatStampTime = (iso?: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return formatDateInPreferredTimeZone(date, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
};

/** Format the date portion of an ISO timestamp as "Today" or "Mon D", in the preferred time zone. */
export const formatStampDate = (iso?: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const isToday = getDateKeyInPreferredTimeZone(new Date()) === getDateKeyInPreferredTimeZone(date);
  if (isToday) return 'Today';
  return formatDateInPreferredTimeZone(date, { month: 'short', day: 'numeric' });
};

const stripHtmlTags = (html: string): string => {
  let result = '';
  let inTag = false;

  for (const char of html) {
    if (char === '<') {
      inTag = true;
      continue;
    }
    if (char === '>') {
      inTag = false;
      continue;
    }
    if (!inTag) {
      result += char;
    }
  }

  return result;
};

const replaceNbsp = (value: string): string => {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '&' && value.slice(index, index + 6) === '&nbsp;') {
      result += ' ';
      index += 5;
      continue;
    }
    result += value[index];
  }

  return result;
};

/** Strip HTML tags to test whether a rich-text value carries any content. */
export const richTextIsEmpty = (value: string | undefined): boolean => {
  if (!value) return true;
  const stripped = replaceNbsp(stripHtmlTags(value)).trim();
  return stripped.length === 0;
};
