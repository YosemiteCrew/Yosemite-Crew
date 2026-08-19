'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useWheelToHorizontalScroll } from '@/app/hooks/useWheelToHorizontalScroll';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import GenericTable, { Column } from '@/app/ui/tables/GenericTable/GenericTable';
import '@/app/ui/tables/DataTable.css';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSearchStore } from '@/app/stores/searchStore';
import { useIntegrationByProviderForPrimaryOrg } from '@/app/hooks/useIntegrations';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import {
  getApiErrorMessage,
  getIdexxCensus,
  getIdexxOrderById,
  getIdexxResultById,
  getIdexxResultPdfBlob,
  listIdexxOrders,
  listIdexxResults,
} from '@/app/features/integrations/services/idexxService';
import {
  CensusEntry,
  LabOrder,
  LabResult,
  LabResultTest,
} from '@/app/features/integrations/services/types';
import Modal from '@/app/ui/overlays/Modal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import ModalFooter from '@/app/ui/overlays/Modal/ModalFooter';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import Close from '@/app/ui/primitives/Icons/Close';
import LabResultValue from '@/app/ui/widgets/LabResultValue';
import { formatDateTimeLocal } from '@/app/lib/date';
import { getSafeIdexxIframeUrl } from '@/app/lib/urls';
import {
  IoAdd,
  IoCalendarClearOutline,
  IoCheckmarkCircleOutline,
  IoChevronDownOutline,
  IoDocumentAttachOutline,
  IoFlaskOutline,
  IoInformationCircleOutline,
  IoOpenOutline,
  IoRefreshOutline,
  IoSyncOutline,
} from 'react-icons/io5';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import MobileSearchBar from '@/app/ui/layout/MobileSearchBar/MobileSearchBar';
import TableHead from '@/app/ui/tables/TableHead';

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];
const MODALITY_FILTERS = [
  { label: 'All modalities', value: 'ALL' },
  { label: 'Reference Lab', value: 'REFLAB' },
  { label: 'In-House', value: 'INHOUSE' },
];

type ModalityFilter = 'ALL' | 'REFLAB' | 'INHOUSE';
const IDEXX_REGIONAL_AVAILABILITY_DISCLAIMER =
  'IDEXX integration availability is currently limited to the USA, Canada, and the UK.';
const IDEXX_HUB_INFO =
  'Yosemite Crew integrates with IDEXX Reference Laboratories and their point-of-care diagnostics for a seamless workflow.';

type CensusTone = 'green' | 'blue' | 'amber';
const CENSUS_TONE_COLOR: Record<CensusTone, string> = {
  green: 'var(--success)',
  blue: 'var(--blue)',
  amber: 'var(--color-warning-600)',
};

const formatTitleCase = (value?: string | null, fallback = 'Unknown') => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const normalized = raw.toLowerCase().replaceAll(/[_-]+/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

// Census avatars are species-tinted in the design (each card carries a species
// photo on a coloured ring). The IDEXX census payload has no image, so the
// initials fallback keeps the species tint rather than a flat blue for everyone.
const SPECIES_AVATAR_STYLE: Record<string, React.CSSProperties> = {
  dog: { background: 'var(--avatar-amber-bg)', color: 'var(--avatar-amber-ink)' },
  cat: { background: 'var(--avatar-violet-bg)', color: 'var(--avatar-violet-ink)' },
  horse: { background: 'var(--avatar-green-bg)', color: 'var(--avatar-green-ink)' },
};
const DEFAULT_AVATAR_STYLE: React.CSSProperties = {
  background: 'var(--avatar-blue-bg)',
  color: 'var(--blue-text)',
};

const getSpeciesAvatarStyle = (speciesCode?: string | null): React.CSSProperties => {
  const key = String(speciesCode ?? '')
    .trim()
    .toLowerCase();
  if (key.includes('canine') || key.includes('dog')) return SPECIES_AVATAR_STYLE.dog;
  if (key.includes('feline') || key.includes('cat')) return SPECIES_AVATAR_STYLE.cat;
  if (key.includes('equine') || key.includes('horse')) return SPECIES_AVATAR_STYLE.horse;
  return DEFAULT_AVATAR_STYLE;
};

const getInitials = (value?: string | null): string => {
  const parts = String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

const isResultComplete = (status?: string | null): boolean => {
  const key = String(status ?? '').toLowerCase();
  return key.includes('complete') || key.includes('final') || key.includes('confirm');
};

// There is no acknowledgement state yet — LabResult carries none, the lab-result
// API is read-only, and `labs:view:any` is the only labs permission. So "awaiting
// review" is derived purely from completion: every completed result stays in the
// queue. That over-reports rather than hiding a result, which is the safe side to
// fail on until a real, attributable acknowledgement is added (#1867). Do NOT
// fake it client-side: a localStorage or useState ack is per-browser and
// unaudited, so a result one vet "acknowledged" silently leaves their queue
// while a colleague still sees it.
const resultAwaitingReview = (result: LabResult): boolean => isResultComplete(result.status);

const getResultOwnerName = (result: LabResult): string =>
  [result.clientFirstName, result.clientLastName]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');

const formatCensusIvlsDevices = (entry: CensusEntry) => {
  const devices = entry.ivls ?? [];
  if (devices.length === 0) return '-';
  return devices
    .map((device) => {
      const serial = String(device.serialNumber ?? '').trim();
      const displayName = String(device.displayName ?? '').trim();
      if (displayName && serial) return `${displayName} (${serial})`;
      return displayName || serial || '-';
    })
    .join(', ');
};

const getCensusDeviceSerial = (entry: CensusEntry): string => {
  const first = (entry.ivls ?? [])[0];
  return String(first?.serialNumber ?? '').trim();
};

const buildCensusDeviceByPatientId = (entries: CensusEntry[]): Record<string, string> =>
  entries.reduce<Record<string, string>>((acc, entry) => {
    const patientId = String(entry.patient?.patientId ?? '').trim();
    const serial = getCensusDeviceSerial(entry);
    if (patientId && serial) acc[patientId] = serial;
    return acc;
  }, {});

const getCensusCardStatus = (
  entry: CensusEntry,
  results: LabResult[]
): { label: string; tone: CensusTone; pulse: boolean } => {
  const patientId = String(entry.patient?.patientId ?? '').trim();
  const patientResults = results.filter(
    (result) => String(result.patientId ?? '').trim() === patientId
  );
  const complete = patientResults.filter((result) => isResultComplete(result.status)).length;
  const running = patientResults.length - complete;
  // In-progress runs keep the patient "blue" even when some panels are already
  // back; the card flips green only once every run has landed.
  if (running > 0) {
    const suffix = complete > 0 ? ` · ${complete} complete` : '';
    return { label: `${running} running${suffix}`, tone: 'blue', pulse: false };
  }
  if (complete > 0) return { label: 'Results ready · awaiting review', tone: 'green', pulse: true };
  return { label: 'Awaiting collection', tone: 'amber', pulse: false };
};

const getResultStatusTone = (status?: string | null): StatusTone => {
  const key = String(status ?? '').toLowerCase();
  if (key.includes('complete') || key.includes('final')) return 'success';
  if (key.includes('error') || key.includes('fail') || key.includes('cancel')) return 'danger';
  if (
    key.includes('pending') ||
    key.includes('running') ||
    key.includes('partial') ||
    key.includes('inprocess')
  ) {
    return 'progress';
  }
  return 'neutral';
};

const parseFloatSafe = (value?: string): number | null => {
  if (!value) return null;
  const cleaned = String(value)
    .replaceAll(',', '.')
    .replaceAll(/[^0-9.+-]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseReferenceRange = (range?: string): { min: number; max: number } | null => {
  if (!range) return null;
  const matches = range.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length < 2) return null;
  const min = Number.parseFloat(matches[0]);
  const max = Number.parseFloat(matches[1]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
  return { min, max };
};

const getMeterMeta = (test: LabResultTest) => {
  const range = parseReferenceRange(test.referenceRange);
  const value = parseFloatSafe(test.result);
  if (!range || value == null) {
    return { canRender: false, percent: 0, markerClass: 'bg-text-secondary' };
  }
  const rawPercent = ((value - range.min) / (range.max - range.min)) * 100;
  const percent = Math.min(100, Math.max(0, rawPercent));
  const markerClass =
    test.outOfRange || rawPercent < 0 || rawPercent > 100
      ? 'bg-[var(--danger)]'
      : 'bg-text-primary';
  return { canRender: true, percent, markerClass };
};

const getOrderUiUrl = (order: LabOrder | null): string => {
  if (!order) return '';
  const nestedUrl = String(
    (order as unknown as { responsePayload?: { uiURL?: string } })?.responsePayload?.uiURL ?? ''
  ).trim();
  const raw = String(order.uiUrl ?? '').trim() || nestedUrl;
  return getSafeIdexxIframeUrl(raw);
};

const getOrderPdfUrl = (order: LabOrder | null): string => {
  if (!order) return '';
  const nestedUrl = String(
    (order as unknown as { responsePayload?: { pdfURL?: string } })?.responsePayload?.pdfURL ?? ''
  ).trim();
  const raw = String(order.pdfUrl ?? '').trim() || nestedUrl;
  return getSafeIdexxIframeUrl(raw);
};

const buildAppointmentIdByOrderId = (orders: LabOrder[]): Record<string, string> =>
  orders.reduce<Record<string, string>>((acc, order) => {
    const orderId = String(order.idexxOrderId ?? '').trim();
    const appointmentId = String(order.appointmentId ?? '').trim();
    if (orderId && appointmentId) acc[orderId] = appointmentId;
    return acc;
  }, {});

const PatientCell = ({ result }: { result: LabResult }) => {
  const owner = getResultOwnerName(result);
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-caption-2 font-bold"
        style={{ background: 'var(--avatar-blue-bg)', color: 'var(--blue-text)' }}
        aria-hidden="true"
      >
        {getInitials(result.patientName)}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body-4 text-text-primary">{result.patientName ?? '-'}</span>
        <span className="truncate text-caption-1 text-text-secondary">
          {owner || `ID ${result.patientId ?? '-'}`}
        </span>
      </span>
    </div>
  );
};

const StatusCell = ({ result }: { result: LabResult }) => (
  <StatusPill
    tone={getResultStatusTone(result.status)}
    label={formatTitleCase(result.status, '-')}
  />
);

type ResultActionCellProps = {
  result: LabResult;
  appointmentLabsHref: string;
  openResultDetails: (result: LabResult) => Promise<void>;
};

const ResultActionCell = ({
  result,
  appointmentLabsHref,
  openResultDetails,
}: ResultActionCellProps) => {
  const awaitingReview = resultAwaitingReview(result);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {appointmentLabsHref ? (
        <Link
          href={appointmentLabsHref}
          aria-label={`Open appointment labs for result ${result.resultId}`}
          title="Open appointment labs"
          className="rounded-full p-2 transition-colors hover:bg-card-hover"
        >
          <IoOpenOutline className="text-text-primary" size={16} />
        </Link>
      ) : null}
      {awaitingReview ? (
        <Primary
          href="#"
          text="Review"
          onClick={() => openResultDetails(result).catch(() => undefined)}
          className="px-4"
        />
      ) : (
        <Secondary
          href="#"
          text="Details"
          onClick={() => openResultDetails(result).catch(() => undefined)}
          className="px-4"
        />
      )}
    </div>
  );
};

type ResultsColumnsOptions = {
  censusDeviceByPatientId: Record<string, string>;
  getAppointmentLabsHref: (result: LabResult) => string;
  openResultDetails: (result: LabResult) => Promise<void>;
  terminologyText: (text: string) => string;
};

export const buildResultsColumns = ({
  censusDeviceByPatientId,
  getAppointmentLabsHref,
  openResultDetails,
  terminologyText,
}: ResultsColumnsOptions): Column<LabResult>[] => [
  {
    label: terminologyText('Patient'),
    key: 'patientName',
    width: '22%',
    render: (result) => <PatientCell result={result} />,
  },
  {
    label: 'Accession #',
    key: 'accessionId',
    width: '14%',
    render: (result) => (
      <span className="text-body-4 text-text-primary tabular-nums">
        {result.accessionId ?? '-'}
      </span>
    ),
  },
  {
    label: 'Order ID',
    key: 'orderId',
    width: '12%',
    render: (result) => (
      <span className="text-body-4 text-text-secondary tabular-nums">{result.orderId ?? '-'}</span>
    ),
  },
  {
    label: 'IVLS Device ID',
    key: 'ivls',
    width: '13%',
    render: (result) => (
      <span className="text-body-4 text-text-secondary tabular-nums">
        {censusDeviceByPatientId[String(result.patientId ?? '').trim()] ?? '-'}
      </span>
    ),
  },
  {
    label: 'Collection date',
    key: 'updatedAt',
    width: '13%',
    render: (result) => (
      <span className="text-body-4 text-text-secondary">
        {formatDateTimeLocal(result.updatedAt, '-')}
      </span>
    ),
  },
  {
    label: 'Status',
    key: 'status',
    width: '12%',
    render: (result) => <StatusCell result={result} />,
  },
  {
    label: '',
    key: 'actions',
    width: '14%',
    render: (result) => (
      <ResultActionCell
        result={result}
        appointmentLabsHref={getAppointmentLabsHref(result)}
        openResultDetails={openResultDetails}
      />
    ),
  },
];

const normalizeModality = (modality?: string | null): Exclude<ModalityFilter, 'ALL'> | null => {
  const raw = String(modality ?? '')
    .trim()
    .toUpperCase();
  if (!raw) return null;
  if (raw === 'REFLAB' || raw === 'REFERENCE_LAB') return 'REFLAB';
  if (raw === 'INHOUSE' || raw === 'IN_HOUSE') return 'INHOUSE';
  return null;
};

const matchesResultQuery = (result: LabResult, q: string): boolean =>
  String(result.resultId ?? '')
    .toLowerCase()
    .includes(q) ||
  String(result.orderId ?? '')
    .toLowerCase()
    .includes(q) ||
  String(result.accessionId ?? '')
    .toLowerCase()
    .includes(q) ||
  String(result.patientName ?? '')
    .toLowerCase()
    .includes(q) ||
  String(result.patientId ?? '')
    .toLowerCase()
    .includes(q) ||
  String(result.requisitionId ?? '')
    .toLowerCase()
    .includes(q) ||
  String(result.status ?? '')
    .toLowerCase()
    .includes(q);

type MobileResultCardProps = {
  result: LabResult;
  appointmentLabsHref: string;
  censusDeviceByPatientId: Record<string, string>;
  openResultDetails: (result: LabResult) => Promise<void>;
};

const MobileResultCard = ({
  result,
  appointmentLabsHref,
  censusDeviceByPatientId,
  openResultDetails,
}: MobileResultCardProps) => (
  <div
    className="flex flex-col gap-2 rounded-2xl border p-3"
    style={{ background: 'var(--screen)', borderColor: 'var(--hairline)' }}
  >
    <div className="flex items-start justify-between gap-2">
      <PatientCell result={result} />
      <StatusCell result={result} />
    </div>
    <div className="grid grid-cols-2 gap-2 text-caption-1">
      <div className="text-text-secondary">Accession #</div>
      <div className="text-right text-text-primary tabular-nums">{result.accessionId ?? '-'}</div>
      <div className="text-text-secondary">Order ID</div>
      <div className="text-right text-text-primary tabular-nums">{result.orderId ?? '-'}</div>
      <div className="text-text-secondary">IVLS Device ID</div>
      <div className="text-right text-text-primary tabular-nums">
        {censusDeviceByPatientId[String(result.patientId ?? '').trim()] ?? '-'}
      </div>
      <div className="text-text-secondary">Collection date</div>
      <div className="text-right text-text-primary">
        {formatDateTimeLocal(result.updatedAt, '-')}
      </div>
    </div>
    <ResultActionCell
      result={result}
      appointmentLabsHref={appointmentLabsHref}
      openResultDetails={openResultDetails}
    />
  </div>
);

type ResultDetailBodyProps = {
  resultDetailLoading: boolean;
  activeResultDetail: LabResult | null;
  terminologyText: (text: string) => string;
};

export const ResultDetailBody = ({
  resultDetailLoading,
  activeResultDetail,
  terminologyText,
}: ResultDetailBodyProps) => {
  const onWheelHorizontal = useWheelToHorizontalScroll();
  if (resultDetailLoading) {
    return <div className="text-body-4 text-text-secondary">Loading result details…</div>;
  }
  if (!activeResultDetail) {
    return <div className="text-body-4 text-text-secondary">No result selected.</div>;
  }
  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
      <div className="rounded-2xl border border-card-border p-3">
        <div className="text-body-4 text-text-primary">
          Result ID: {activeResultDetail.resultId}
        </div>
        <div className="text-caption-1 text-text-secondary">
          Status: {formatTitleCase(activeResultDetail.status, '-')}{' '}
          {activeResultDetail.statusDetail ? `| ${activeResultDetail.statusDetail}` : ''}
        </div>
        <div className="text-caption-1 text-text-secondary">
          Order: {activeResultDetail.orderId ?? '-'}
        </div>
        <div className="text-caption-1 text-text-secondary">
          Requisition: {activeResultDetail.requisitionId ?? '-'}
        </div>
        <div className="text-caption-1 text-text-secondary">
          {terminologyText('Patient')}: {activeResultDetail.patientName ?? '-'} (
          {activeResultDetail.patientId ?? '-'})
        </div>
      </div>

      {(activeResultDetail.rawPayload?.categories ?? []).map((category) => (
        <div
          key={`${activeResultDetail.resultId}-${category.name}`}
          className="rounded-2xl border border-card-border p-3"
        >
          <div className="mb-2 text-body-4 text-text-primary">{category.name}</div>
          <div className="scrollbar-x-float overflow-x-auto" onWheel={onWheelHorizontal}>
            <table className="w-full min-w-[620px]">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="py-1 pr-2 text-left text-caption-1 text-text-tertiary">Test</th>
                  <th className="py-1 pr-2 text-left text-caption-1 text-text-tertiary">Value</th>
                  <th className="py-1 pr-2 text-left text-caption-1 text-text-tertiary">
                    Reference
                  </th>
                  <th className="py-1 text-left text-caption-1 text-text-tertiary">Meter</th>
                </tr>
              </thead>
              <tbody>
                {category.tests.map((test, idx) => {
                  const meter = getMeterMeta(test);
                  return (
                    <tr
                      key={`${category.name}-${test.name}-${idx}`}
                      className="border-b border-card-border last:border-0"
                    >
                      <td className="py-2 pr-2 text-caption-1 text-text-primary">{test.name}</td>
                      <td
                        className={`py-2 pr-2 text-caption-1 ${test.outOfRange ? 'text-text-error' : 'text-text-primary'}`}
                      >
                        <LabResultValue test={test} />
                      </td>
                      <td className="py-2 pr-2 text-caption-1 text-text-secondary">
                        {test.referenceRange ?? '-'}
                      </td>
                      <td className="py-2">
                        {meter.canRender ? (
                          <div className="relative h-2 w-48 rounded-full bg-card-hover">
                            <div
                              className={`absolute top-1/2 h-4 w-1.5 -translate-y-1/2 rounded ${meter.markerClass}`}
                              style={{ left: `calc(${meter.percent}% - 3px)` }}
                            />
                          </div>
                        ) : (
                          <span className="text-caption-1 text-text-secondary">N/A</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {(activeResultDetail.rawPayload?.runSummaries ?? []).length > 0 ? (
        <div className="rounded-2xl border border-card-border p-3">
          <div className="mb-2 text-body-4 text-text-primary">Run summaries</div>
          <ol className="list-decimal space-y-1 pl-5">
            {(activeResultDetail.rawPayload?.runSummaries ?? []).map((run) => (
              <li key={run.id} className="text-caption-1 text-text-secondary">
                {run.name} ({run.code})
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
};

const ORDER_DETAIL_TITLE_ID = 'idexx-order-detail-title';

type OrderDetailPanelProps = {
  activeResultDetail: LabResult | null;
  resultDetailLoading: boolean;
  terminologyText: (text: string) => string;
  appointmentLabsHref: string;
  pdfPreviewLoadingId: string | null;
  openResultPdfPreview: (resultId: string) => Promise<void>;
  onClose: () => void;
};

const OrderDetailPanel = ({
  activeResultDetail,
  resultDetailLoading,
  terminologyText,
  appointmentLabsHref,
  pdfPreviewLoadingId,
  openResultPdfPreview,
  onClose,
}: OrderDetailPanelProps) => {
  const owner = activeResultDetail ? getResultOwnerName(activeResultDetail) : '';
  const pdfLoading = pdfPreviewLoadingId === activeResultDetail?.resultId;
  return (
    <div className="flex h-full flex-col gap-4">
      <ModalHeader
        eyebrow="Order detail"
        title={activeResultDetail?.accessionId ?? activeResultDetail?.resultId ?? 'Order'}
        titleId={ORDER_DETAIL_TITLE_ID}
        actions={activeResultDetail ? <StatusCell result={activeResultDetail} /> : null}
        onClose={onClose}
      />

      {activeResultDetail ? (
        <div
          className="flex items-center gap-3 rounded-2xl border p-3"
          style={{ background: 'var(--screen)', borderColor: 'var(--hairline)' }}
        >
          <span
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-caption-1 font-bold"
            style={{ background: 'var(--avatar-blue-bg)', color: 'var(--blue-text)' }}
            aria-hidden="true"
          >
            {getInitials(activeResultDetail.patientName)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body-4 text-text-primary">
              {activeResultDetail.patientName ?? '-'}
            </span>
            <span className="truncate text-caption-1 text-text-secondary">
              {owner || `${terminologyText('Patient')} ${activeResultDetail.patientId ?? '-'}`}
            </span>
          </span>
          {appointmentLabsHref ? (
            <Link
              href={appointmentLabsHref}
              aria-label={`Open appointment labs for result ${activeResultDetail.resultId}`}
              title="Open appointment labs"
              className="rounded-full p-1.5 transition-colors hover:bg-card-hover"
            >
              <IoOpenOutline size={16} style={{ color: 'var(--blue-text)' }} />
            </Link>
          ) : null}
        </div>
      ) : null}

      <ResultDetailBody
        resultDetailLoading={resultDetailLoading}
        activeResultDetail={activeResultDetail}
        terminologyText={terminologyText}
      />

      <ModalFooter align="stretch">
        <div className="flex flex-col gap-2">
          <Primary
            href={appointmentLabsHref || '#'}
            text="Open in appointment labs"
            icon={<IoCheckmarkCircleOutline aria-hidden="true" />}
            isDisabled={!appointmentLabsHref}
            ariaLabel="Open in appointment labs"
          />
          <Secondary
            href="#"
            text={pdfLoading ? 'Loading PDF...' : 'Open results PDF'}
            icon={<IoDocumentAttachOutline aria-hidden="true" />}
            isDisabled={!activeResultDetail || pdfLoading}
            onClick={() => {
              if (activeResultDetail) {
                openResultPdfPreview(activeResultDetail.resultId).catch(() => undefined);
              }
            }}
          />
        </div>
      </ModalFooter>
    </div>
  );
};

const IDEXX_FOLLOWUP_LOADER_TESTID = 'idexx-followup-loader';

const getAutoRefreshLabel = (autoRefresh: boolean): string => {
  if (autoRefresh) return 'Auto-refresh: On';
  return 'Auto-refresh: Off';
};

const getRefreshButtonLabel = (loading: boolean): string => {
  if (loading) return 'Refreshing...';
  return 'Refresh';
};

const getStartRow = (page: number, pageSize: number, pageCount: number): number => {
  if (pageCount === 0) return 0;
  return (page - 1) * pageSize + 1;
};

type IdexxFollowUpPortalProps = {
  open: boolean;
  followUpFrameUrl: string | null;
  onClose: () => void;
};

const IdexxFollowUpPortal = ({ open, followUpFrameUrl, onClose }: IdexxFollowUpPortalProps) => {
  const [loaded, setLoaded] = useState(false);
  if (!open || !followUpFrameUrl || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-[var(--sh55)] p-4 backdrop-blur-sm"
      data-signing-overlay="true"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="relative flex size-full max-h-[95vh] max-w-7xl flex-col overflow-hidden rounded-2xl bg-neutral-0 shadow-2xl">
        <div className="flex items-center justify-between border-b border-card-border px-4 py-2">
          <div className="text-body-2 text-text-primary">IDEXX follow-up hub</div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full p-2 transition-colors hover:bg-neutral-100"
            aria-label="Close IDEXX follow-up frame"
            style={{ pointerEvents: 'auto' }}
          >
            <Close iconOnly />
          </button>
        </div>
        <div className="relative flex-1">
          {loaded ? null : (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-0">
              <YosemiteLoader
                label="Loading IDEXX"
                size={120}
                testId={IDEXX_FOLLOWUP_LOADER_TESTID}
              />
            </div>
          )}
          <iframe
            key={followUpFrameUrl}
            src={followUpFrameUrl}
            title="IDEXX follow-up hub"
            className="size-full border-0"
            loading="lazy"
            sandbox="allow-scripts allow-popups allow-forms allow-same-origin"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ pointerEvents: 'auto' }}
            onLoad={() => setLoaded(true)}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

type MobileResultsListProps = {
  paginatedResults: LabResult[];
  getAppointmentLabsHref: (result: LabResult) => string;
  censusDeviceByPatientId: Record<string, string>;
  openResultDetails: (result: LabResult) => Promise<void>;
};

const MobileResultsList = ({
  paginatedResults,
  getAppointmentLabsHref,
  censusDeviceByPatientId,
  openResultDetails,
}: MobileResultsListProps) => {
  if (paginatedResults.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border p-4 text-body-4 text-text-secondary">
        No results found.
      </div>
    );
  }

  return (
    <>
      {paginatedResults.map((result) => (
        <MobileResultCard
          key={result.resultId}
          result={result}
          appointmentLabsHref={getAppointmentLabsHref(result)}
          censusDeviceByPatientId={censusDeviceByPatientId}
          openResultDetails={openResultDetails}
        />
      ))}
    </>
  );
};

type CensusStripProps = {
  entries: CensusEntry[];
  results: LabResult[];
  totalResults: number;
};

const CensusStrip = ({ entries, results, totalResults }: CensusStripProps) => (
  <section aria-label="Census overview" className="flex flex-col gap-2">
    <span className="text-caption-3" style={{ color: 'var(--ink-faint)', letterSpacing: '0.1em' }}>
      Census overview
    </span>
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
      {entries.slice(0, 3).map((entry) => {
        const status = getCensusCardStatus(entry, results);
        return (
          <div
            key={`${entry.id}-${entry.patient.patientId}`}
            className="flex items-center gap-2.5 rounded-2xl border p-3"
            style={{
              background: 'var(--screen)',
              borderColor: 'var(--hairline)',
              boxShadow: '0 1px 2px var(--sh03)',
            }}
          >
            <span
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-caption-1 font-bold"
              style={getSpeciesAvatarStyle(entry.patient.speciesCode)}
              aria-hidden="true"
            >
              {getInitials(entry.patient.name)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-bold" style={{ color: 'var(--ink)' }}>
                {entry.patient.name}
              </span>
              <span className="truncate text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                {status.label}
              </span>
            </span>
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: CENSUS_TONE_COLOR[status.tone] }}
              aria-hidden="true"
            />
          </div>
        );
      })}
      <div
        className="flex flex-col justify-center gap-0.5 rounded-2xl border p-3"
        style={{ background: 'var(--inset)', borderColor: 'var(--divider)' }}
      >
        <span
          className="text-[19px] leading-tight font-bold tracking-[-0.02em] tabular-nums"
          style={{ color: 'var(--ink)' }}
        >
          {totalResults} results
        </span>
        <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
          across {entries.length} patients today
        </span>
      </div>
    </div>
  </section>
);

type CensusEntriesListProps = {
  entries: CensusEntry[];
  terminologyText: (text: string) => string;
};

const CensusEntriesList = ({ entries, terminologyText }: CensusEntriesListProps) => {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border p-3 text-body-4 text-text-secondary">
        No in-house census entries found.
      </div>
    );
  }

  return (
    <>
      {entries.map((entry) => (
        <div
          key={`${entry.id}-${entry.patient.patientId}`}
          className="rounded-2xl border border-card-border bg-neutral-0 p-3"
        >
          <div className="text-body-4 text-text-primary">{entry.patient.name}</div>
          <div className="mt-0.5 text-caption-1 text-text-secondary">
            {terminologyText('Patient ID')}: {entry.patient.patientId}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-caption-1">
            <div className="text-text-secondary">Confirmed</div>
            <div className="text-right text-text-primary">{entry.confirmed ? 'Yes' : 'No'}</div>
            <div className="text-text-secondary">IVLS Device ID</div>
            <div className="text-right text-text-primary">{formatCensusIvlsDevices(entry)}</div>
            <div className="text-text-secondary">Veterinarian</div>
            <div className="text-right text-text-primary">{entry.veterinarian ?? '-'}</div>
          </div>
        </div>
      ))}
    </>
  );
};

const getOrderExternalStatusSuffix = (order: LabOrder): string => {
  if (!order.externalStatus) return '';
  const externalStatus = String(order.externalStatus).trim().toLowerCase();
  const currentStatus = String(order.status ?? '')
    .trim()
    .toLowerCase();
  if (!externalStatus || externalStatus === currentStatus) return '';
  return ` (${formatTitleCase(order.externalStatus, '-')})`;
};

type OrderLookupCardProps = {
  order: LabOrder;
  openOrderAcknowledgement: (order: LabOrder | null) => void;
  openFollowUpWorkspace: (order: LabOrder | null) => void;
};

const OrderLookupCard = ({
  order,
  openOrderAcknowledgement,
  openFollowUpWorkspace,
}: OrderLookupCardProps) => (
  <div className="flex flex-col gap-1 rounded-2xl border border-card-border p-3">
    <div className="text-body-4 text-text-primary">Order {order.idexxOrderId}</div>
    <div className="text-caption-1 text-text-secondary">
      Status: {formatTitleCase(order.status, '-')}
      {getOrderExternalStatusSuffix(order)}
    </div>
    <div className="text-caption-1 text-text-secondary">
      Modality: {formatTitleCase(order.modality, '-')}
    </div>
    <div className="text-caption-1 text-text-secondary">
      Updated: {formatDateTimeLocal(order.updatedAt, '-')}
    </div>
    <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
      <Secondary
        href="#"
        text="View acknowledgment"
        onClick={() => openOrderAcknowledgement(order)}
        className="px-4"
      />
      <Primary
        href="#"
        text="Open follow-up"
        onClick={() => openFollowUpWorkspace(order)}
        className="px-4"
      />
    </div>
  </div>
);

const SKELETON_ROWS = [
  { opacity: 1, width: '96px' },
  { opacity: 0.75, width: '120px' },
  { opacity: 0.5, width: '84px' },
  { opacity: 0.28, width: '108px' },
];

const SyncingSkeleton = ({ lastRefreshedAt }: { lastRefreshedAt: string | null }) => (
  <div className="flex flex-col" aria-hidden="true">
    <div
      className="flex items-center justify-between border-b px-5 py-3"
      style={{ borderColor: 'var(--hairline)' }}
    >
      <span
        className="flex items-center gap-[9px] text-[14px] font-bold"
        style={{ color: 'var(--ink)' }}
      >
        <IoSyncOutline className="animate-spin" size={16} style={{ color: 'var(--blue-text)' }} />
        Syncing with IDEXX…
      </span>
      <span className="text-caption-1 text-text-secondary">
        Last sync {formatDateTimeLocal(lastRefreshedAt, '—')}
      </span>
    </div>
    <TableHead
      columns={[
        { key: 'patient', label: 'Patient' },
        { key: 'accession', label: 'Accession #' },
        { key: 'device', label: 'Device' },
        { key: 'status', label: 'Status' },
      ]}
      track="1.4fr 1fr 1fr 90px"
      gap="12px"
      sticky={false}
    />
    {SKELETON_ROWS.map((row) => (
      <div
        key={row.width}
        className="grid grid-cols-[1.4fr_1fr_1fr_90px] items-center gap-3 border-t px-5 py-3"
        style={{ borderColor: 'var(--hairline)', opacity: row.opacity }}
      >
        <span className="flex items-center gap-2.5">
          <span className="size-8 rounded-full" style={{ background: 'var(--inset)' }} />
          <span
            className="h-3 rounded-md"
            style={{ background: 'var(--inset)', width: row.width }}
          />
        </span>
        <span className="h-3 w-24 rounded-md" style={{ background: 'var(--inset)' }} />
        <span className="h-3 w-20 rounded-md" style={{ background: 'var(--inset)' }} />
        <span className="h-5 w-16 rounded-full" style={{ background: 'var(--inset)' }} />
      </div>
    ))}
  </div>
);

const HubInfoPill = () => (
  <GlassTooltip content={IDEXX_HUB_INFO} side="bottom">
    <button
      type="button"
      aria-label="IDEXX Hub info"
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption-1 font-bold transition-colors"
      style={{ background: 'var(--blue-soft)', color: 'var(--blue-text)' }}
    >
      <IoInformationCircleOutline size={13} aria-hidden="true" />
      IDEXX Hub info
    </button>
  </GlassTooltip>
);

const NotConnectedState = () => (
  <div className="flex flex-1 items-center justify-center py-8">
    <div
      className="flex w-full max-w-[520px] flex-col items-center gap-4 rounded-3xl border px-11 py-[52px] text-center"
      style={{
        background: 'var(--screen)',
        borderColor: 'var(--hairline)',
        boxShadow: '0 1px 2px var(--sh03), 0 14px 40px var(--sh05)',
      }}
    >
      <span
        className="inline-flex size-[74px] items-center justify-center rounded-full"
        style={{ background: 'var(--blue-soft)', color: 'var(--blue-text)' }}
        aria-hidden="true"
      >
        <IoFlaskOutline size={32} />
      </span>
      <div className="flex flex-col gap-2">
        <span className="text-page-title">IDEXX isn&apos;t connected yet</span>
        <span
          className="text-[14px] leading-[1.6] text-pretty"
          style={{ color: 'var(--ink-muted)' }}
        >
          Connect your IDEXX account to order labs from the visit and pull results from in-house
          analyzers straight into the record.
        </span>
      </div>
      <div className="flex w-full max-w-[320px] flex-col gap-2">
        <Primary
          href="/integrations"
          text="Enable IDEXX in Integrations"
          iconPosition="right"
          className="text-[14px] font-semibold"
          style={{ minHeight: 46 }}
        />
        <Link
          href="/integrations"
          className="flex h-10 items-center justify-center gap-1.5 text-[13px] font-semibold"
          style={{ color: 'var(--blue-text)' }}
        >
          <IoOpenOutline size={16} aria-hidden="true" />
          Open Integrations
        </Link>
      </div>
      <span className="text-caption-1 text-text-secondary">
        Works with Catalyst One, ProCyte Dx and VetLab UA stations
      </span>
    </div>
  </div>
);

type ModalityPillsProps = {
  modalityFilter: ModalityFilter;
  awaitingReviewOnly: boolean;
  onSelectModality: (value: ModalityFilter) => void;
  onToggleAwaitingReview: () => void;
};

const MODALITY_PILL_ACTIVE_STYLE: React.CSSProperties = {
  background: 'var(--inset)',
  borderColor: 'var(--divider)',
  color: 'var(--ink)',
  fontWeight: 700,
};
const MODALITY_PILL_IDLE_STYLE: React.CSSProperties = {
  borderColor: 'var(--hairline)',
  color: 'var(--ink-muted)',
  fontWeight: 600,
};

const ModalityPills = ({
  modalityFilter,
  awaitingReviewOnly,
  onSelectModality,
  onToggleAwaitingReview,
}: ModalityPillsProps) => {
  return (
    // Phone: a single horizontally scrollable row. Tablet / desktop: wraps.
    <div className="scrollbar-x-float flex items-center gap-2 overflow-x-auto md:flex-wrap md:overflow-visible">
      {MODALITY_FILTERS.map((filter) => {
        const active = modalityFilter === filter.value;
        return (
          <button
            key={filter.value}
            type="button"
            aria-pressed={active}
            onClick={() => onSelectModality(filter.value as ModalityFilter)}
            className="inline-flex shrink-0 items-center rounded-full border px-[13px] py-1.5 text-caption-1 whitespace-nowrap transition-colors"
            style={active ? MODALITY_PILL_ACTIVE_STYLE : MODALITY_PILL_IDLE_STYLE}
          >
            {filter.label}
          </button>
        );
      })}
      <span
        className="mx-1 hidden h-4 w-px md:block"
        style={{ background: 'var(--hairline)' }}
        aria-hidden="true"
      />
      <button
        type="button"
        aria-pressed={awaitingReviewOnly}
        onClick={onToggleAwaitingReview}
        className="inline-flex shrink-0 items-center rounded-full border px-[13px] py-1.5 text-caption-1 whitespace-nowrap transition-colors"
        style={awaitingReviewOnly ? MODALITY_PILL_ACTIVE_STYLE : MODALITY_PILL_IDLE_STYLE}
      >
        Awaiting review
      </button>
      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-[13px] py-1.5 text-caption-1 whitespace-nowrap md:ml-auto"
        style={MODALITY_PILL_IDLE_STYLE}
      >
        <IoCalendarClearOutline size={12} aria-hidden="true" />
        Last 7 days
        <IoChevronDownOutline size={12} aria-hidden="true" />
      </span>
    </div>
  );
};

type IdexxWorkspaceActionsState = {
  primaryOrgId: string | null | undefined;
  integrationEnabled: boolean;
  orderLookupId: string;
  pdfPreviewLoadingId: string | null;
  pdfPreviewUrl: string | null;
  appointmentIdByOrderId: Record<string, string>;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setResults: (v: LabResult[]) => void;
  setCensusEntries: (v: CensusEntry[]) => void;
  setAppointmentIdByOrderId: (v: Record<string, string>) => void;
  setLastRefreshedAt: (v: string) => void;
  setOrderLookupLoading: (v: boolean) => void;
  setOrderLookup: (v: LabOrder | null) => void;
  setShowResultModal: (v: boolean) => void;
  setResultDetailLoading: (v: boolean) => void;
  setActiveResultDetail: (v: LabResult | null) => void;
  setShowPdfPreview: (v: boolean) => void;
  setPdfPreviewUrl: (v: string | null) => void;
  setPdfPreviewTitle: (v: string) => void;
  setPdfPreviewLoadingId: (v: string | null) => void;
  setFollowUpFrameUrl: (v: string | null) => void;
  setShowFollowUpFrame: (v: boolean) => void;
};

const useIdexxWorkspaceActions = (s: IdexxWorkspaceActionsState) => {
  // Keep a stable ref to the latest state object so callbacks never need `s`
  // in their dep arrays (which would cause a new ref every render → infinite loop).
  const sRef = React.useRef(s);
  useEffect(() => {
    sRef.current = s;
  });

  const refresh = useCallback(async () => {
    const { primaryOrgId: orgId, integrationEnabled: enabled } = sRef.current;
    if (!orgId) return;
    sRef.current.setLoading(true);
    sRef.current.setError(null);
    try {
      if (!enabled) {
        sRef.current.setResults([]);
        sRef.current.setCensusEntries([]);
        sRef.current.setAppointmentIdByOrderId({});
        sRef.current.setLastRefreshedAt(new Date().toISOString());
        return;
      }
      const [allResults, census, orders] = await Promise.all([
        listIdexxResults(orgId),
        getIdexxCensus(orgId),
        listIdexxOrders({ organisationId: orgId }),
      ]);
      sRef.current.setResults(allResults);
      sRef.current.setCensusEntries(census);
      sRef.current.setAppointmentIdByOrderId(buildAppointmentIdByOrderId(orders));
      sRef.current.setLastRefreshedAt(new Date().toISOString());
    } catch (e) {
      sRef.current.setError(getApiErrorMessage(e, 'Unable to load IDEXX Hub data.'));
    } finally {
      sRef.current.setLoading(false);
    }
  }, []);

  // Unlike the async actions below, this is called during render (to build row
  // hrefs), so it must read the lookup from the current render, not the ref.
  const { appointmentIdByOrderId } = s;
  const getAppointmentLabsHref = useCallback(
    (result: LabResult) => {
      const lookup = appointmentIdByOrderId;
      const raw = result.rawPayload as
        | {
            orderId?: string | number;
            requisitionId?: string | number;
            accessionId?: string | number;
            alternateOrderId?: string | number;
            alternateRequisitionId?: string | number;
          }
        | undefined;
      const lookupIds = [
        result.orderId,
        result.requisitionId,
        result.accessionId,
        raw?.orderId,
        raw?.requisitionId,
        raw?.accessionId,
        raw?.alternateOrderId,
        raw?.alternateRequisitionId,
      ]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean);
      const matchedOrderIdentifier = lookupIds.find((id) => lookup[id]) ?? '';
      if (!matchedOrderIdentifier) return '';
      const params = new URLSearchParams({
        appointmentId: lookup[matchedOrderIdentifier],
        open: 'labs',
        subLabel: 'idexx-labs',
      });
      return `/appointments?${params.toString()}`;
    },
    [appointmentIdByOrderId]
  );

  const handleLookupOrder = useCallback(async () => {
    const { primaryOrgId: orgId, orderLookupId: lookupId } = sRef.current;
    if (!orgId || !lookupId.trim()) return;
    sRef.current.setOrderLookupLoading(true);
    sRef.current.setError(null);
    try {
      const order = await getIdexxOrderById({
        organisationId: orgId,
        idexxOrderId: lookupId.trim(),
      });
      sRef.current.setOrderLookup(order);
    } catch (e) {
      sRef.current.setOrderLookup(null);
      sRef.current.setError(getApiErrorMessage(e, 'Order lookup failed.'));
    } finally {
      sRef.current.setOrderLookupLoading(false);
    }
  }, []);

  const openResultDetails = useCallback(async (result: LabResult) => {
    const { primaryOrgId: orgId } = sRef.current;
    if (!orgId) return;
    sRef.current.setShowResultModal(true);
    sRef.current.setResultDetailLoading(true);
    sRef.current.setActiveResultDetail(result);
    sRef.current.setError(null);
    try {
      const detail = await getIdexxResultById({
        organisationId: orgId,
        resultId: result.resultId,
      });
      sRef.current.setActiveResultDetail(detail);
    } catch (e) {
      sRef.current.setError(getApiErrorMessage(e, 'Unable to load result details.'));
    } finally {
      sRef.current.setResultDetailLoading(false);
    }
  }, []);

  const closePdfPreview = useCallback(() => {
    const { pdfPreviewUrl: url } = sRef.current;
    sRef.current.setShowPdfPreview(false);
    if (url?.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
    sRef.current.setPdfPreviewUrl(null);
    sRef.current.setPdfPreviewTitle('IDEXX PDF');
  }, []);

  const openResultPdfPreview = useCallback(async (resultId: string) => {
    const {
      primaryOrgId: orgId,
      pdfPreviewLoadingId: loadingId,
      pdfPreviewUrl: currentUrl,
    } = sRef.current;
    if (!orgId || !resultId || loadingId === resultId) return;
    sRef.current.setPdfPreviewLoadingId(resultId);
    sRef.current.setError(null);
    try {
      const pdfBlob = await getIdexxResultPdfBlob({
        organisationId: orgId,
        resultId,
      });
      const objectUrl = URL.createObjectURL(pdfBlob);
      if (currentUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(currentUrl);
      }
      sRef.current.setPdfPreviewUrl(objectUrl);
      sRef.current.setPdfPreviewTitle(`IDEXX Result PDF #${resultId}`);
      sRef.current.setShowPdfPreview(true);
    } catch (e) {
      sRef.current.setError(getApiErrorMessage(e, 'Unable to load IDEXX PDF preview.'));
    } finally {
      sRef.current.setPdfPreviewLoadingId(null);
    }
  }, []);

  const openOrderAcknowledgement = useCallback((order: LabOrder | null) => {
    const pdfUrl = getOrderPdfUrl(order);
    if (!pdfUrl) {
      sRef.current.setError('Acknowledgment PDF is not available for this order yet.');
      return;
    }
    sRef.current.setError(null);
    sRef.current.setPdfPreviewTitle(
      `IDEXX Order Acknowledgment #${order?.idexxOrderId ?? ''}`.trim()
    );
    sRef.current.setPdfPreviewUrl(pdfUrl);
    sRef.current.setShowPdfPreview(true);
  }, []);

  const openFollowUpWorkspace = useCallback((order: LabOrder | null) => {
    const uiUrl = getOrderUiUrl(order);
    if (!uiUrl) {
      sRef.current.setError('Follow-up workspace URL is not available for this order.');
      return;
    }
    sRef.current.setError(null);
    sRef.current.setFollowUpFrameUrl(uiUrl);
    sRef.current.setShowFollowUpFrame(true);
  }, []);

  return {
    refresh,
    getAppointmentLabsHref,
    handleLookupOrder,
    openResultDetails,
    closePdfPreview,
    openResultPdfPreview,
    openOrderAcknowledgement,
    openFollowUpWorkspace,
  };
};

const useIdexxWorkspacePage = () => {
  const terminologyText = useCompanionTerminologyText();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const idexxIntegration = useIntegrationByProviderForPrimaryOrg('IDEXX');
  const integrationEnabled = (idexxIntegration?.status ?? '').toLowerCase() === 'enabled';

  const [results, setResults] = useState<LabResult[]>([]);
  const [censusEntries, setCensusEntries] = useState<CensusEntry[]>([]);
  const [appointmentIdByOrderId, setAppointmentIdByOrderId] = useState<Record<string, string>>({});
  const headerSearchQuery = useSearchStore((s) => s.query);
  const [modalityFilter, setModalityFilter] = useState<ModalityFilter>('ALL');
  const [awaitingReviewOnly, setAwaitingReviewOnly] = useState(false);
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [orderLookupId, setOrderLookupId] = useState('');
  const [orderLookup, setOrderLookup] = useState<LabOrder | null>(null);
  const [orderLookupLoading, setOrderLookupLoading] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [activeResultDetail, setActiveResultDetail] = useState<LabResult | null>(null);
  const [resultDetailLoading, setResultDetailLoading] = useState(false);
  const [showFollowUpFrame, setShowFollowUpFrame] = useState(false);
  const [followUpFrameUrl, setFollowUpFrameUrl] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState('IDEXX PDF');
  const [pdfPreviewLoadingId, setPdfPreviewLoadingId] = useState<string | null>(null);

  const actions = useIdexxWorkspaceActions({
    primaryOrgId,
    integrationEnabled,
    orderLookupId,
    pdfPreviewLoadingId,
    pdfPreviewUrl,
    appointmentIdByOrderId,
    setLoading,
    setError,
    setResults,
    setCensusEntries,
    setAppointmentIdByOrderId,
    setLastRefreshedAt,
    setOrderLookupLoading,
    setOrderLookup,
    setShowResultModal,
    setResultDetailLoading,
    setActiveResultDetail,
    setShowPdfPreview,
    setPdfPreviewUrl,
    setPdfPreviewTitle,
    setPdfPreviewLoadingId,
    setFollowUpFrameUrl,
    setShowFollowUpFrame,
  });
  const refresh = actions.refresh;

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh || !integrationEnabled) return;
    const timer = setInterval(() => {
      refresh().catch(() => undefined);
    }, 30000);
    return () => clearInterval(timer);
  }, [autoRefresh, integrationEnabled, refresh]);

  const filteredResults = useMemo(() => {
    const q = headerSearchQuery.trim().toLowerCase();
    return results.filter((result) => {
      if (modalityFilter !== 'ALL') {
        const resultModality = normalizeModality(result.modality);
        if (resultModality !== modalityFilter) return false;
      }
      if (awaitingReviewOnly && !resultAwaitingReview(result)) return false;
      return !q || matchesResultQuery(result, q);
    });
  }, [results, headerSearchQuery, modalityFilter, awaitingReviewOnly]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  // When the result set shrinks below the current page (filters, page size, or a
  // background refresh), clamp during render rather than paying an extra render
  // through an effect. The condition converges, so it never loops.
  if (page > totalPages) {
    setPage(totalPages);
  }

  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredResults.slice(start, start + pageSize);
  }, [filteredResults, currentPage, pageSize]);

  // Reset to the first page when the header search changes — derived during
  // render (prev-value compare) instead of a useEffect, so there's no extra frame.
  const [prevSearchQuery, setPrevSearchQuery] = useState(headerSearchQuery);
  if (headerSearchQuery !== prevSearchQuery) {
    setPrevSearchQuery(headerSearchQuery);
    setPage(1);
  }

  const censusDeviceByPatientId = useMemo(
    () => buildCensusDeviceByPatientId(censusEntries),
    [censusEntries]
  );

  const resultsColumns = useMemo(
    () =>
      buildResultsColumns({
        censusDeviceByPatientId,
        getAppointmentLabsHref: actions.getAppointmentLabsHref,
        openResultDetails: actions.openResultDetails,
        terminologyText,
      }),
    [
      censusDeviceByPatientId,
      actions.getAppointmentLabsHref,
      actions.openResultDetails,
      terminologyText,
    ]
  );

  // Tablet sheds the lower-priority Order ID + IVLS Device ID columns so the
  // table fits a 768-1279px viewport without horizontal scroll.
  const tabletResultsColumns = useMemo(
    () => resultsColumns.filter((column) => column.key !== 'orderId' && column.key !== 'ivls'),
    [resultsColumns]
  );

  const summary = useMemo(
    () => ({
      totalResults: results.length,
      censusCount: censusEntries.length,
      awaitingReviewCount: results.filter(resultAwaitingReview).length,
    }),
    [results, censusEntries.length]
  );

  return {
    integrationEnabled,
    loading,
    error,
    autoRefresh,
    setAutoRefresh,
    modalityFilter,
    setModalityFilter,
    awaitingReviewOnly,
    setAwaitingReviewOnly,
    pageSize,
    setPageSize,
    page: currentPage,
    setPage,
    lastRefreshedAt,
    orderLookupId,
    setOrderLookupId,
    orderLookup,
    orderLookupLoading,
    showResultModal,
    setShowResultModal,
    activeResultDetail,
    resultDetailLoading,
    showFollowUpFrame,
    setShowFollowUpFrame,
    followUpFrameUrl,
    showPdfPreview,
    pdfPreviewUrl,
    pdfPreviewTitle,
    pdfPreviewLoadingId,
    filteredResults,
    totalPages,
    paginatedResults,
    resultsColumns,
    tabletResultsColumns,
    censusDeviceByPatientId,
    summary,
    censusEntries,
    results,
    actions,
  };
};

const IdexxHubHeader = ({ subtitleSuffix }: { subtitleSuffix: React.ReactNode }) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="flex flex-col gap-2">
      <h1 className="flex flex-wrap items-center gap-2 text-page-title">
        IDEXX diagnostics
        <HubInfoPill />
      </h1>
      <p className="text-[13.5px]" style={{ color: 'var(--ink-muted)' }}>
        Orders and results from your in-house analyzers{subtitleSuffix}
      </p>
    </div>
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Primary
        href="/appointments"
        text="New order"
        icon={<IoAdd aria-hidden="true" />}
        ariaLabel="Create a new order"
      />
    </div>
  </div>
);

const IdexxWorkspacePage = () => {
  const terminologyText = useCompanionTerminologyText();
  const s = useIdexxWorkspacePage();
  const autoRefreshLabel = getAutoRefreshLabel(s.autoRefresh);
  const refreshButtonLabel = getRefreshButtonLabel(s.loading);
  const startRow = getStartRow(s.page, s.pageSize, s.paginatedResults.length);
  const showSkeleton = s.loading && s.filteredResults.length === 0;
  const activeAppointmentLabsHref = s.activeResultDetail
    ? s.actions.getAppointmentLabsHref(s.activeResultDetail)
    : '';
  const subtitleSuffix =
    s.summary.awaitingReviewCount > 0 ? (
      <>
        {' · '}
        <span className="font-semibold" style={{ color: 'var(--ink-body)' }}>
          {s.summary.awaitingReviewCount} results awaiting review
        </span>
      </>
    ) : null;
  const handleRefresh = () => {
    s.actions.refresh().catch(() => undefined);
  };
  const handleToggleAutoRefresh = () => {
    s.setAutoRefresh((prev) => !prev);
  };

  if (!s.integrationEnabled && !s.loading) {
    return (
      <div className="flex min-h-[70vh] flex-col gap-4 p-3 md:p-5">
        <IdexxHubHeader subtitleSuffix={null} />
        <NotConnectedState />
        <div className="text-caption-2 text-text-extra">
          {IDEXX_REGIONAL_AVAILABILITY_DISCLAIMER}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-3 md:p-5">
      <PdfPreviewOverlay
        open={s.showPdfPreview}
        pdfUrl={s.pdfPreviewUrl}
        title={s.pdfPreviewTitle}
        closeLabel="Close IDEXX PDF preview"
        onClose={s.actions.closePdfPreview}
      />
      <IdexxFollowUpPortal
        open={s.showFollowUpFrame}
        followUpFrameUrl={s.followUpFrameUrl}
        onClose={() => s.setShowFollowUpFrame(false)}
      />

      <MobileSearchBar placeholder="Search accession, patient" />

      <IdexxHubHeader subtitleSuffix={subtitleSuffix} />

      {s.error ? (
        <div role="alert" className="text-body-4 text-text-error">
          {s.error}
        </div>
      ) : null}

      <CensusStrip
        entries={s.censusEntries}
        results={s.results}
        totalResults={s.summary.totalResults}
      />

      <ModalityPills
        modalityFilter={s.modalityFilter}
        awaitingReviewOnly={s.awaitingReviewOnly}
        onSelectModality={(value) => {
          s.setModalityFilter(value);
          s.setPage(1);
        }}
        onToggleAwaitingReview={() => {
          s.setAwaitingReviewOnly((prev) => !prev);
          s.setPage(1);
        }}
      />

      <div
        className="flex flex-col overflow-hidden rounded-2xl border"
        style={{
          background: 'var(--screen)',
          borderColor: 'var(--hairline)',
          boxShadow: '0 1px 2px var(--sh03), 0 8px 22px var(--sh05)',
        }}
      >
        {showSkeleton ? (
          <SyncingSkeleton lastRefreshedAt={s.lastRefreshedAt} />
        ) : (
          <>
            {/* Desktop (>=1280px): full-detail table. */}
            <div className="hidden xl:block">
              <GenericTable data={s.paginatedResults} columns={s.resultsColumns} bordered={false} />
            </div>
            {/* Tablet (768-1279px): the pruned table (drops Order ID + IVLS). */}
            <div className="hidden md:block xl:hidden">
              <GenericTable
                data={s.paginatedResults}
                columns={s.tabletResultsColumns}
                bordered={false}
              />
            </div>
            {/* Phone (<768px): each order becomes a stacked card. */}
            <div className="flex flex-col gap-3 p-3 md:hidden">
              <MobileResultsList
                paginatedResults={s.paginatedResults}
                getAppointmentLabsHref={s.actions.getAppointmentLabsHref}
                censusDeviceByPatientId={s.censusDeviceByPatientId}
                openResultDetails={s.actions.openResultDetails}
              />
            </div>
          </>
        )}

        <div
          className="flex flex-col gap-2 border-t p-3"
          style={{ borderColor: 'var(--hairline)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-caption-1 text-text-secondary">
              {s.filteredResults.length} orders · last device sync{' '}
              {formatDateTimeLocal(s.lastRefreshedAt, '—')}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Secondary
                href="#"
                text={autoRefreshLabel}
                onClick={handleToggleAutoRefresh}
                className="px-4"
              />
              <Secondary
                href="#"
                text={refreshButtonLabel}
                onClick={handleRefresh}
                className="px-4"
              />
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex items-center gap-1.5 text-caption-1 font-semibold transition-colors"
                style={{ color: 'var(--blue-text)' }}
              >
                <IoRefreshOutline size={13} aria-hidden="true" />
                Refresh from IDEXX
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              aria-live="polite"
              aria-atomic="true"
              className="text-caption-1 text-text-secondary"
            >
              Showing {startRow}-{(s.page - 1) * s.pageSize + s.paginatedResults.length} of{' '}
              {s.filteredResults.length}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-[130px]">
                <LabelDropdown
                  placeholder="Page size"
                  options={PAGE_SIZE_OPTIONS.map((size) => ({
                    label: String(size),
                    value: String(size),
                  }))}
                  defaultOption={String(s.pageSize)}
                  onSelect={(option) => {
                    s.setPageSize(Number(option.value));
                    s.setPage(1);
                  }}
                />
              </div>
              <nav
                aria-label="Results pagination"
                className="flex flex-wrap items-center justify-end gap-2"
              >
                <Back
                  onClick={() => s.setPage((p) => Math.max(1, p - 1))}
                  disabled={s.page <= 1}
                  className={s.page <= 1 ? 'hover:bg-neutral-0! cursor-not-allowed opacity-40' : ''}
                />
                <div aria-current="page" className="text-body-4 text-text-primary">
                  Page {s.page} / {s.totalPages}
                </div>
                <Next
                  onClick={() => s.setPage((p) => Math.min(s.totalPages, p + 1))}
                  disabled={s.page >= s.totalPages}
                  className={
                    s.page >= s.totalPages
                      ? 'hover:bg-neutral-0! cursor-not-allowed opacity-40'
                      : ''
                  }
                />
              </nav>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Accordion title="Patient census" defaultOpen showEditIcon={false} isEditing>
          <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto py-2 pr-1">
            <CensusEntriesList entries={s.censusEntries} terminologyText={terminologyText} />
          </div>
        </Accordion>

        <Accordion title="Order lookup" defaultOpen showEditIcon={false} isEditing>
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_auto]">
              <FormInput
                intype="text"
                inname="idexx-order-id"
                inlabel="IDEXX order ID"
                value={s.orderLookupId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  s.setOrderLookupId(e.target.value)
                }
              />
              <Primary
                href="#"
                text={s.orderLookupLoading ? 'Looking up...' : 'Lookup order'}
                onClick={s.actions.handleLookupOrder}
                isDisabled={s.orderLookupLoading || !s.orderLookupId.trim()}
                className="min-w-[160px]"
              />
            </div>

            {s.orderLookup ? (
              <OrderLookupCard
                order={s.orderLookup}
                openOrderAcknowledgement={s.actions.openOrderAcknowledgement}
                openFollowUpWorkspace={s.actions.openFollowUpWorkspace}
              />
            ) : null}
          </div>
        </Accordion>
      </div>

      <Modal
        showModal={s.showResultModal}
        setShowModal={s.setShowResultModal}
        size="md"
        aria-labelledby={ORDER_DETAIL_TITLE_ID}
      >
        <OrderDetailPanel
          activeResultDetail={s.activeResultDetail}
          resultDetailLoading={s.resultDetailLoading}
          terminologyText={terminologyText}
          appointmentLabsHref={activeAppointmentLabsHref}
          pdfPreviewLoadingId={s.pdfPreviewLoadingId}
          openResultPdfPreview={s.actions.openResultPdfPreview}
          onClose={() => s.setShowResultModal(false)}
        />
      </Modal>

      <div className="text-caption-2 text-text-extra">{IDEXX_REGIONAL_AVAILABILITY_DISCLAIMER}</div>
    </div>
  );
};

const ProtectedIdexxWorkspace = () => (
  <ProtectedRoute>
    <OrgGuard>
      <IdexxWorkspacePage />
    </OrgGuard>
  </ProtectedRoute>
);

// Exported for unit testing of the pure helpers / presentational branches.
export {
  getInitials,
  isResultComplete,
  formatCensusIvlsDevices,
  getCensusDeviceSerial,
  buildCensusDeviceByPatientId,
  getCensusCardStatus,
  getResultStatusTone,
  getMeterMeta,
  getOrderUiUrl,
  getOrderPdfUrl,
  buildAppointmentIdByOrderId,
  getOrderExternalStatusSuffix,
  normalizeModality,
  matchesResultQuery,
  OrderDetailPanel,
};

export default ProtectedIdexxWorkspace;
