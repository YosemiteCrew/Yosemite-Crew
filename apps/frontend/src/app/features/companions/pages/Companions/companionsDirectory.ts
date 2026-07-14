import type { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import type { AppointmentWithCompanion } from '@/app/features/appointments/types/appointments';

// Warm-bone tinted avatar discs, cycled deterministically per companion so the
// monogram fallback keeps a stable colour across renders.
export type AvatarPalette = { bg: string; ink: string };

const AVATAR_PALETTES: AvatarPalette[] = [
  { bg: 'var(--avatar-green-bg)', ink: 'var(--avatar-green-ink)' },
  { bg: 'var(--avatar-amber-bg)', ink: 'var(--avatar-amber-ink)' },
  { bg: 'var(--avatar-violet-bg)', ink: 'var(--avatar-violet-ink)' },
];

export const getAvatarPalette = (seed?: string | null): AvatarPalette => {
  const key = String(seed ?? '');
  let hash = 0;
  for (const char of key) {
    hash = (hash + (char.codePointAt(0) as number)) % AVATAR_PALETTES.length;
  }
  return AVATAR_PALETTES[hash];
};

export const getMonogram = (name?: string | null): string => {
  const trimmed = String(name ?? '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
};

export type SpeciesCounts = {
  all: number;
  dog: number;
  cat: number;
  horse: number;
  other: number;
};

// Exotics === everything that is not a dog / cat / horse.
export const getSpeciesCounts = (companions: CompanionParent[]): SpeciesCounts => {
  const counts: SpeciesCounts = { all: companions.length, dog: 0, cat: 0, horse: 0, other: 0 };
  for (const item of companions) {
    const type = String(item.companion.type ?? '').toLowerCase();
    if (type === 'dog') counts.dog += 1;
    else if (type === 'cat') counts.cat += 1;
    else if (type === 'horse') counts.horse += 1;
    else counts.other += 1;
  }
  return counts;
};

export const getActiveCount = (companions: CompanionParent[]): number =>
  companions.filter((item) => String(item.companion.status ?? '').toLowerCase() === 'active')
    .length;

export type SpeciesTab = {
  key: 'all' | 'dog' | 'cat' | 'horse' | 'other';
  label: string;
  countKey: keyof SpeciesCounts;
};

export const SPECIES_TABS: SpeciesTab[] = [
  { key: 'all', label: 'All', countKey: 'all' },
  { key: 'dog', label: 'Dogs', countKey: 'dog' },
  { key: 'cat', label: 'Cats', countKey: 'cat' },
  { key: 'horse', label: 'Horses', countKey: 'horse' },
  { key: 'other', label: 'Exotics', countKey: 'other' },
];

const appointmentStart = (appointment: AppointmentWithCompanion): Date =>
  new Date(appointment.startTime ?? appointment.appointmentDate);

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const isToday = (value?: Date | string | null, now: Date = new Date()): boolean => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return isSameDay(date, now);
};

const EXCLUDED_BAND_STATUSES = new Set(['CANCELLED', 'NO_SHOW']);

// The "In the clinic today" band: today's appointments, soonest first, capped.
export const getTodaysAppointments = (
  appointments: AppointmentWithCompanion[],
  now: Date = new Date(),
  limit = 4
): AppointmentWithCompanion[] =>
  appointments
    .filter(
      (appointment) => !EXCLUDED_BAND_STATUSES.has(String(appointment.status ?? '').toUpperCase())
    )
    .filter((appointment) => isSameDay(appointmentStart(appointment), now))
    .sort((a, b) => appointmentStart(a).getTime() - appointmentStart(b).getTime())
    .slice(0, limit);

export type InClinicStatusMeta = { label: string; color: string };

export const getInClinicStatusMeta = (status?: string): InClinicStatusMeta => {
  switch (String(status ?? '').toUpperCase()) {
    case 'IN_PROGRESS':
      return { label: 'In progress', color: 'var(--status-in-progress-text)' };
    case 'CHECKED_IN':
      return { label: 'Checked in', color: 'var(--status-checked-in-text)' };
    case 'UPCOMING':
      return { label: 'Arriving', color: 'var(--status-upcoming-text)' };
    default:
      return { label: 'Booked', color: 'var(--ink-faint)' };
  }
};

// Last visit === the most recent appointment that has already started.
export const getLastVisit = (
  appointments: AppointmentWithCompanion[],
  companionId?: string,
  now: Date = new Date()
): AppointmentWithCompanion | null => {
  if (!companionId) return null;
  const past = appointments
    .filter((appointment) => appointment.companion?.id === companionId)
    .filter((appointment) => appointmentStart(appointment).getTime() <= now.getTime())
    .sort((a, b) => appointmentStart(b).getTime() - appointmentStart(a).getTime());
  return past[0] ?? null;
};

export const getLastVisitStart = (
  appointments: AppointmentWithCompanion[],
  companionId?: string,
  now: Date = new Date()
): Date | null => {
  const visit = getLastVisit(appointments, companionId, now);
  return visit ? appointmentStart(visit) : null;
};

// Row status ink: Active reads as the completed/green ink, Inactive fades out.
export const getCompanionRowStatusColor = (status?: string): string => {
  switch (String(status ?? '').toLowerCase()) {
    case 'active':
      return 'var(--status-completed-text)';
    case 'archived':
      return 'var(--status-upcoming-text)';
    default:
      return 'var(--ink-faint)';
  }
};

// A companion is co-parented when its parent links carry a live CO_PARENT entry.
// Real signal only — never fabricated, so it stays hidden until link data exists.
export const hasCoParent = (item: CompanionParent): boolean => {
  const links = (item.companion as { parentLinks?: Array<{ role?: string; status?: string }> })
    .parentLinks;
  if (!Array.isArray(links)) return false;
  return links.some(
    (link) =>
      String(link.role ?? '').toUpperCase() === 'CO_PARENT' &&
      String(link.status ?? '').toUpperCase() !== 'REVOKED'
  );
};

export const sortByLastVisit = (
  list: CompanionParent[],
  appointments: AppointmentWithCompanion[],
  now: Date = new Date()
): CompanionParent[] => {
  const startTime = (item: CompanionParent): number =>
    getLastVisitStart(appointments, item.companion.id, now)?.getTime() ?? Number.NEGATIVE_INFINITY;
  return [...list].sort((a, b) => startTime(b) - startTime(a));
};
