import type { IconType } from 'react-icons';
import {
  IoBandageOutline,
  IoCloudUploadOutline,
  IoCutOutline,
  IoDocumentTextOutline,
  IoFlaskOutline,
  IoMedicalOutline,
  IoMedkitOutline,
  IoShieldCheckmarkOutline,
  IoSparklesOutline,
  IoWaterOutline,
} from 'react-icons/io5';
import { CompanionRecord } from '@/app/features/documents/types/companionDocuments';
import {
  RecordLifecycleFilter,
  filterRecordsByLifecycle,
  getLifecycleForFilter,
} from '@/app/features/documents/components/recordLifecycle';

/** Where a record came from. Always available on every record. */
export type RecordSourceFilter = 'ALL' | 'UPLOADED' | 'SYNCED';

/**
 * The record list's filter tabs: the source dimension above plus the design's
 * lifecycle tabs, which only render for lifecycles the loaded records actually
 * resolve to (see `getAvailableLifecycleTabs`).
 */
export type RecordFilter = RecordSourceFilter | RecordLifecycleFilter;

/** Sort direction on the record's effective date. */
export type RecordSortDirection = 'desc' | 'asc';

/** Visual tone for a record status pill, mapped to the design's status tokens. */
export type RecordStatusTone = 'success' | 'warning' | 'info';

export type RecordStatusPill = {
  label: string;
  tone: RecordStatusTone;
};

export type RecordMonthGroup = {
  label: string;
  items: CompanionRecord[];
};

const HEALTH_ICONS: Record<string, IconType> = {
  LAB_TEST: IoFlaskOutline,
  PRESCRIPTION: IoMedkitOutline,
  VACCINATION: IoShieldCheckmarkOutline,
  IMAGING_OR_DIAGNOSTIC: IoMedicalOutline,
  SURGERY_OR_PROCEDURE: IoBandageOutline,
  DISCHARGE_SUMMARY: IoDocumentTextOutline,
  PARASITE_PREVENTION: IoBandageOutline,
  MEDICAL_CONDITION: IoMedicalOutline,
};

const HYGIENE_ICONS: Record<string, IconType> = {
  BATHING: IoWaterOutline,
  NAIL_TRIM: IoCutOutline,
  GROOMING: IoSparklesOutline,
  EAR_CLEANING: IoWaterOutline,
  DENTAL_CLEANING: IoSparklesOutline,
  SKIN_CARE: IoSparklesOutline,
  ANAL_GLAND_EXPRESSION: IoWaterOutline,
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * A typed leading glyph for the record row, matching the design's per-type icon
 * tiles. Falls back to a generic document (synced) or upload (manual) glyph when
 * the sub-category is unrecognised.
 */
export const getRecordIcon = (doc: CompanionRecord): IconType => {
  const bySubcategory = HEALTH_ICONS[doc.subcategory] ?? HYGIENE_ICONS[doc.subcategory];
  if (bySubcategory) return bySubcategory;
  return doc.syncedFromPms ? IoDocumentTextOutline : IoCloudUploadOutline;
};

/** Where the record came from, in plain language, for the row sub-line. */
export const getDocumentSource = (doc: CompanionRecord): string => {
  if (doc.issuingBusinessName) return doc.issuingBusinessName;
  if (doc.syncedFromPms) return 'PMS';
  if (doc.uploadedByParentId) return 'Pet parent';
  return 'Staff';
};

/** A short attachment count summary for the row meta line. */
export const getAttachmentSummary = (doc: CompanionRecord): string => {
  if (!doc.attachments?.length) return 'No attachments';
  const first = doc.attachments[0];
  const mime = first?.mimeType ? first.mimeType.split('/').pop()?.toUpperCase() : 'FILE';
  return doc.attachments.length > 1
    ? `${doc.attachments.length} files (${mime || 'FILE'})`
    : `1 file (${mime || 'FILE'})`;
};

/**
 * Trailing status pills for a record. Source (Synced vs Manual) is always shown;
 * a record that is visible to the pet parent app also carries a "PMS visible"
 * pill. Both preserve the semantics of the previous badges, restyled to the
 * design's pill treatment.
 */
export const getRecordStatusPills = (doc: CompanionRecord): RecordStatusPill[] => {
  const pills: RecordStatusPill[] = [
    doc.syncedFromPms ? { label: 'Synced', tone: 'success' } : { label: 'Manual', tone: 'warning' },
  ];
  if (doc.pmsVisible) pills.push({ label: 'PMS visible', tone: 'info' });
  return pills;
};

const getRecordRawDate = (doc: CompanionRecord): string | undefined =>
  doc.issueDate || doc.createdAt || doc.updatedAt;

/** Absolute time value used for sorting; `null` when the record has no date. */
export const getRecordDateValue = (doc: CompanionRecord): number | null => {
  const raw = getRecordRawDate(doc);
  if (!raw) return null;
  const value = new Date(raw).getTime();
  return Number.isNaN(value) ? null : value;
};

/**
 * The month/year bucket a record belongs to (e.g. "July 2026"). Uses UTC parts
 * so a date-only value never drifts a month across time zones. Undatable records
 * bucket under "Undated".
 */
export const getMonthGroupLabel = (doc: CompanionRecord): string => {
  const raw = getRecordRawDate(doc);
  if (!raw) return 'Undated';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return 'Undated';
  return `${MONTH_NAMES[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`;
};

export const filterRecords = (
  records: CompanionRecord[],
  filter: RecordFilter
): CompanionRecord[] => {
  if (filter === 'UPLOADED') return records.filter((doc) => !doc.syncedFromPms);
  if (filter === 'SYNCED') return records.filter((doc) => Boolean(doc.syncedFromPms));
  const lifecycle = getLifecycleForFilter(filter);
  if (lifecycle) return filterRecordsByLifecycle(records, lifecycle);
  return records;
};

export const sortRecords = (
  records: CompanionRecord[],
  direction: RecordSortDirection
): CompanionRecord[] =>
  [...records].sort((a, b) => {
    const av = getRecordDateValue(a);
    const bv = getRecordDateValue(b);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return direction === 'asc' ? av - bv : bv - av;
  });

/** Groups records into month buckets, preserving the incoming (sorted) order. */
export const groupRecordsByMonth = (records: CompanionRecord[]): RecordMonthGroup[] => {
  const groups: RecordMonthGroup[] = [];
  const byLabel = new Map<string, RecordMonthGroup>();
  for (const doc of records) {
    const label = getMonthGroupLabel(doc);
    let group = byLabel.get(label);
    if (!group) {
      group = { label, items: [] };
      byLabel.set(label, group);
      groups.push(group);
    }
    group.items.push(doc);
  }
  return groups;
};
