'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import GenericTable, { Column } from '@/app/ui/tables/GenericTable/GenericTable';
import '@/app/ui/tables/DataTable.css';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import { useOrgStore } from '@/app/stores/orgStore';
import { useIntegrationByProviderForPrimaryOrg } from '@/app/hooks/useIntegrations';
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
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';
import Close from '@/app/ui/primitives/Icons/Close';
import LabResultValue from '@/app/ui/widgets/LabResultValue';
import { formatDateTimeLocal } from '@/app/lib/date';
import { IoOpenOutline } from 'react-icons/io5';

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];
const MODALITY_FILTERS = [
  { label: 'All modalities', value: 'ALL' },
  { label: 'Reference Lab', value: 'REFLAB' },
  { label: 'In-House', value: 'INHOUSE' },
];

type ModalityFilter = 'ALL' | 'REFLAB' | 'INHOUSE';

const formatTitleCase = (value?: string | null, fallback = 'Unknown') => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const normalized = raw.toLowerCase().replaceAll(/[_-]+/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getResultStatusStyle = (status?: string | null): React.CSSProperties => {
  const key = String(status ?? '').toLowerCase();
  if (key.includes('complete') || key.includes('final'))
    return { color: '#F7F7F7', backgroundColor: '#D9A488' };
  if (key.includes('error') || key.includes('fail') || key.includes('cancel')) {
    return { color: '#F7F7F7', backgroundColor: '#D28F9A' };
  }
  if (
    key.includes('pending') ||
    key.includes('running') ||
    key.includes('partial') ||
    key.includes('inprocess')
  ) {
    return { color: '#F7F7F7', backgroundColor: '#747283' };
  }
  return { color: '#302F2E', backgroundColor: '#F1D4B0' };
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
    test.outOfRange || rawPercent < 0 || rawPercent > 100 ? 'bg-red-500' : 'bg-text-primary';
  return { canRender: true, percent, markerClass };
};

const getOrderUiUrl = (order: LabOrder | null): string => {
  if (!order) return '';
  const nestedUrl = String(
    (order as unknown as { responsePayload?: { uiURL?: string } })?.responsePayload?.uiURL ?? ''
  ).trim();
  return String(order.uiUrl ?? '').trim() || nestedUrl;
};

const getOrderPdfUrl = (order: LabOrder | null): string => {
  if (!order) return '';
  const nestedUrl = String(
    (order as unknown as { responsePayload?: { pdfURL?: string } })?.responsePayload?.pdfURL ?? ''
  ).trim();
  return String(order.pdfUrl ?? '').trim() || nestedUrl;
};

const buildAppointmentIdByOrderId = (orders: LabOrder[]): Record<string, string> =>
  orders.reduce<Record<string, string>>((acc, order) => {
    const orderId = String(order.idexxOrderId ?? '').trim();
    const appointmentId = String(order.appointmentId ?? '').trim();
    if (orderId && appointmentId) acc[orderId] = appointmentId;
    return acc;
  }, {});

type ResultsColumnsOptions = {
  pdfPreviewLoadingId: string | null;
  getAppointmentLabsHref: (result: LabResult) => string;
  openResultDetails: (result: LabResult) => Promise<void>;
  openResultPdfPreview: (resultId: string) => Promise<void>;
};

const buildResultsColumns = ({
  pdfPreviewLoadingId,
  getAppointmentLabsHref,
  openResultDetails,
  openResultPdfPreview,
}: ResultsColumnsOptions): Column<LabResult>[] => [
  {
    label: 'Patient',
    key: 'patientName',
    width: '25%',
    render: (result) => (
      <div className="flex flex-col">
        <div className="text-body-4 text-text-primary">{result.patientName ?? '-'}</div>
        <div className="text-caption-1 text-text-secondary">Result: {result.resultId}</div>
        <div className="text-caption-1 text-text-secondary">
          Patient ID: {result.patientId ?? '-'}
        </div>
      </div>
    ),
  },
  {
    label: 'Updated',
    key: 'updatedAt',
    width: '13%',
    render: (result) => (
      <div className="text-body-4 text-text-primary">
        {formatDateTimeLocal(result.updatedAt, '-')}
      </div>
    ),
  },
  {
    label: 'Status',
    key: 'status',
    width: '16%',
    render: (result) => (
      <div className="flex flex-col gap-1">
        <div className="appointment-status w-fit" style={getResultStatusStyle(result.status)}>
          {formatTitleCase(result.status, '-')}
        </div>
        {result.statusDetail ? (
          <span className="text-caption-1 text-text-secondary">{result.statusDetail}</span>
        ) : null}
      </div>
    ),
  },
  {
    label: 'Order / Req',
    key: 'orderId',
    width: '16%',
    render: (result) => (
      <div className="flex flex-col">
        <div className="text-body-4 text-text-primary">{result.orderId ?? '-'}</div>
        <div className="text-caption-1 text-text-secondary">Req: {result.requisitionId ?? '-'}</div>
        <div className="text-caption-1 text-text-secondary">
          Accession: {result.accessionId ?? '-'}
        </div>
      </div>
    ),
  },
  {
    label: 'Actions',
    key: 'actions',
    width: '30%',
    render: (result) => {
      const appointmentLabsHref = getAppointmentLabsHref(result);
      return (
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {appointmentLabsHref ? (
            <Link
              href={appointmentLabsHref}
              aria-label={`Open appointment labs for result ${result.resultId}`}
              title="Open appointment labs"
              className="p-2 rounded-full hover:bg-card-hover transition-colors"
            >
              <IoOpenOutline className="text-text-primary" size={16} />
            </Link>
          ) : null}
          <Secondary
            href="#"
            text="Details"
            onClick={() => openResultDetails(result).catch(() => undefined)}
            className="px-4"
          />
          <Primary
            href="#"
            text={pdfPreviewLoadingId === result.resultId ? 'Loading PDF...' : 'PDF'}
            onClick={() => openResultPdfPreview(result.resultId).catch(() => undefined)}
            className="px-4"
            isDisabled={pdfPreviewLoadingId === result.resultId}
          />
        </div>
      );
    },
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
  pdfPreviewLoadingId: string | null;
  openResultDetails: (result: LabResult) => Promise<void>;
  openResultPdfPreview: (resultId: string) => Promise<void>;
};

const MobileResultCard = ({
  result,
  appointmentLabsHref,
  pdfPreviewLoadingId,
  openResultDetails,
  openResultPdfPreview,
}: MobileResultCardProps) => (
  <div className="rounded-2xl border border-card-border p-3 bg-white flex flex-col gap-2">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-body-4 text-text-primary">{result.patientName ?? '-'}</div>
        <div
          className="text-caption-1 text-text-secondary break-all"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {result.resultId}
        </div>
      </div>
      <div
        className="appointment-status w-fit shrink-0"
        style={getResultStatusStyle(result.status)}
      >
        {formatTitleCase(result.status, '-')}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2 text-caption-1">
      <div className="text-text-secondary">Updated</div>
      <div className="text-text-primary text-right">
        {formatDateTimeLocal(result.updatedAt, '-')}
      </div>
      <div className="text-text-secondary">Order</div>
      <div className="text-text-primary text-right">{result.orderId ?? '-'}</div>
      <div className="text-text-secondary">Req</div>
      <div className="text-text-primary text-right">{result.requisitionId ?? '-'}</div>
      <div className="text-text-secondary">Accession</div>
      <div className="text-text-primary text-right">{result.accessionId ?? '-'}</div>
    </div>
    <div className="flex items-center justify-end gap-2 flex-wrap pt-1">
      {appointmentLabsHref ? (
        <Link
          href={appointmentLabsHref}
          aria-label={`Open appointment labs for result ${result.resultId}`}
          title="Open appointment labs"
          className="p-2 rounded-full hover:bg-card-hover transition-colors"
        >
          <IoOpenOutline className="text-text-primary" size={16} />
        </Link>
      ) : null}
      <Secondary
        href="#"
        text="Details"
        onClick={() => openResultDetails(result).catch(() => undefined)}
        className="px-4"
      />
      <Primary
        href="#"
        text={pdfPreviewLoadingId === result.resultId ? 'Loading PDF...' : 'PDF'}
        onClick={() => openResultPdfPreview(result.resultId).catch(() => undefined)}
        className="px-4"
        isDisabled={pdfPreviewLoadingId === result.resultId}
      />
    </div>
  </div>
);

type ResultDetailModalContentProps = {
  resultDetailLoading: boolean;
  activeResultDetail: LabResult | null;
};

const ResultDetailModalContent = ({
  resultDetailLoading,
  activeResultDetail,
}: ResultDetailModalContentProps) => {
  if (resultDetailLoading) {
    return <div className="text-body-4 text-text-secondary">Loading result details...</div>;
  }
  if (!activeResultDetail) {
    return <div className="text-body-4 text-text-secondary">No result selected.</div>;
  }
  return (
    <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
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
          Patient: {activeResultDetail.patientName ?? '-'} ({activeResultDetail.patientId ?? '-'})
        </div>
      </div>

      {(activeResultDetail.rawPayload?.categories ?? []).map((category) => (
        <div
          key={`${activeResultDetail.resultId}-${category.name}`}
          className="rounded-2xl border border-card-border p-3"
        >
          <div className="text-body-4 text-text-primary mb-2">{category.name}</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left text-caption-1 text-text-tertiary py-1 pr-2">Test</th>
                  <th className="text-left text-caption-1 text-text-tertiary py-1 pr-2">Value</th>
                  <th className="text-left text-caption-1 text-text-tertiary py-1 pr-2">
                    Reference
                  </th>
                  <th className="text-left text-caption-1 text-text-tertiary py-1">Meter</th>
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
                      <td className="text-caption-1 text-text-primary py-2 pr-2">{test.name}</td>
                      <td
                        className={`text-caption-1 py-2 pr-2 ${test.outOfRange ? 'text-red-600' : 'text-text-primary'}`}
                      >
                        <LabResultValue test={test} />
                      </td>
                      <td className="text-caption-1 text-text-secondary py-2 pr-2">
                        {test.referenceRange ?? '-'}
                      </td>
                      <td className="py-2">
                        {meter.canRender ? (
                          <div className="relative h-2 w-48 bg-card-hover rounded-full">
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-4 rounded ${meter.markerClass}`}
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
          <div className="text-body-4 text-text-primary mb-2">Run summaries</div>
          <ol className="list-decimal pl-5 space-y-1">
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

const getAutoRefreshLabel = (autoRefresh: boolean): string => {
  if (autoRefresh) return 'Auto-refresh: On';
  return 'Auto-refresh: Off';
};

const getRefreshButtonLabel = (loading: boolean): string => {
  if (loading) return 'Refreshing...';
  return 'Refresh';
};

const getResultModalOverlayClassName = (showResultModal: boolean): string => {
  const visibleClass = showResultModal ? 'opacity-100' : 'opacity-0 pointer-events-none';
  return `fixed backdrop-blur-[2px] inset-0 bg-[#302f2e80] z-1100 transition-opacity duration-300 ease-in-out ${visibleClass}`;
};

const getResultModalContainerClassName = (showResultModal: boolean): string => {
  const translateClass = showResultModal ? 'translate-x-0' : 'translate-x-[120%]';
  return `fixed top-0 right-0 bottom-0 m-3 p-3 h-[calc(100%-2rem)] w-[calc(100%-2rem)] sm:w-[680px] lg:w-[760px]
          bg-white border border-card-border rounded-2xl z-1200
          transition-transform duration-300 ease-in-out
          ${translateClass}`;
};

const getStartRow = (page: number, pageSize: number, pageCount: number): number => {
  if (pageCount === 0) return 0;
  return (page - 1) * pageSize + 1;
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

type IdexxFollowUpPortalProps = {
  open: boolean;
  followUpFrameUrl: string | null;
  onClose: () => void;
};

const IdexxFollowUpPortal = ({ open, followUpFrameUrl, onClose }: IdexxFollowUpPortalProps) => {
  if (!open || !followUpFrameUrl || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      data-signing-overlay="true"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-black/10">
          <div className="text-body-2 text-text-primary">IDEXX follow-up hub</div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer"
            aria-label="Close IDEXX follow-up frame"
            style={{ pointerEvents: 'auto' }}
          >
            <Close iconOnly />
          </button>
        </div>
        <iframe
          src={followUpFrameUrl}
          title="IDEXX follow-up hub"
          className="flex-1 w-full border-0"
          loading="lazy"
          allowFullScreen
          style={{ pointerEvents: 'auto' }}
        />
      </div>
    </div>,
    document.body
  );
};

type MobileResultsListProps = {
  paginatedResults: LabResult[];
  getAppointmentLabsHref: (result: LabResult) => string;
  pdfPreviewLoadingId: string | null;
  openResultDetails: (result: LabResult) => Promise<void>;
  openResultPdfPreview: (resultId: string) => Promise<void>;
};

const MobileResultsList = ({
  paginatedResults,
  getAppointmentLabsHref,
  pdfPreviewLoadingId,
  openResultDetails,
  openResultPdfPreview,
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
          pdfPreviewLoadingId={pdfPreviewLoadingId}
          openResultDetails={openResultDetails}
          openResultPdfPreview={openResultPdfPreview}
        />
      ))}
    </>
  );
};

const CensusEntriesList = ({ entries }: { entries: CensusEntry[] }) => {
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
          className="rounded-2xl border border-card-border p-3 bg-white"
        >
          <div className="text-body-4 text-text-primary">{entry.patient.name}</div>
          <div className="text-caption-1 text-text-secondary mt-0.5">
            Patient ID: {entry.patient.patientId}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-caption-1">
            <div className="text-text-secondary">Confirmed</div>
            <div className="text-right text-text-primary">{entry.confirmed ? 'Yes' : 'No'}</div>
            <div className="text-text-secondary">Veterinarian</div>
            <div className="text-right text-text-primary">{entry.veterinarian ?? '-'}</div>
          </div>
        </div>
      ))}
    </>
  );
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
  <div className="rounded-2xl border border-card-border p-3 flex flex-col gap-1">
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
    <div className="flex items-center justify-end gap-2 flex-wrap pt-2">
      <Secondary
        href="#"
        text="View acknowledgment"
        onClick={() => openOrderAcknowledgement(order)}
        isDisabled={!getOrderPdfUrl(order)}
        className="px-4"
      />
      <Primary
        href="#"
        text="Open follow-up"
        onClick={() => openFollowUpWorkspace(order)}
        isDisabled={!getOrderUiUrl(order)}
        className="px-4"
      />
    </div>
  </div>
);

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
  const {
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
  } = s;

  const refresh = useCallback(async () => {
    if (!primaryOrgId) return;
    setLoading(true);
    setError(null);
    try {
      if (!integrationEnabled) {
        setResults([]);
        setCensusEntries([]);
        setAppointmentIdByOrderId({});
        setLastRefreshedAt(new Date().toISOString());
        return;
      }
      const [allResults, census, orders] = await Promise.all([
        listIdexxResults(primaryOrgId),
        getIdexxCensus(primaryOrgId),
        listIdexxOrders({ organisationId: primaryOrgId }),
      ]);
      setResults(allResults);
      setCensusEntries(census);
      setAppointmentIdByOrderId(buildAppointmentIdByOrderId(orders));
      setLastRefreshedAt(new Date().toISOString());
    } catch (e) {
      setError(getApiErrorMessage(e, 'Unable to load IDEXX Hub data.'));
    } finally {
      setLoading(false);
    }
  }, [
    primaryOrgId,
    integrationEnabled,
    setLoading,
    setError,
    setResults,
    setCensusEntries,
    setAppointmentIdByOrderId,
    setLastRefreshedAt,
  ]);

  const getAppointmentLabsHref = useCallback(
    (result: LabResult) => {
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
      const matchedOrderIdentifier = lookupIds.find((id) => appointmentIdByOrderId[id]) ?? '';
      if (!matchedOrderIdentifier) return '';
      const params = new URLSearchParams({
        appointmentId: appointmentIdByOrderId[matchedOrderIdentifier],
        open: 'labs',
        subLabel: 'idexx-labs',
      });
      return `/appointments?${params.toString()}`;
    },
    [appointmentIdByOrderId]
  );

  const handleLookupOrder = useCallback(async () => {
    if (!primaryOrgId || !orderLookupId.trim()) return;
    setOrderLookupLoading(true);
    setError(null);
    try {
      const order = await getIdexxOrderById({
        organisationId: primaryOrgId,
        idexxOrderId: orderLookupId.trim(),
      });
      setOrderLookup(order);
    } catch (e) {
      setOrderLookup(null);
      setError(getApiErrorMessage(e, 'Order lookup failed.'));
    } finally {
      setOrderLookupLoading(false);
    }
  }, [primaryOrgId, orderLookupId, setOrderLookupLoading, setError, setOrderLookup]);

  const openResultDetails = useCallback(
    async (result: LabResult) => {
      if (!primaryOrgId) return;
      setShowResultModal(true);
      setResultDetailLoading(true);
      setActiveResultDetail(result);
      setError(null);
      try {
        const detail = await getIdexxResultById({
          organisationId: primaryOrgId,
          resultId: result.resultId,
        });
        setActiveResultDetail(detail);
      } catch (e) {
        setError(getApiErrorMessage(e, 'Unable to load result details.'));
      } finally {
        setResultDetailLoading(false);
      }
    },
    [primaryOrgId, setShowResultModal, setResultDetailLoading, setActiveResultDetail, setError]
  );

  const closePdfPreview = useCallback(() => {
    setShowPdfPreview(false);
    if (pdfPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
    setPdfPreviewUrl(null);
    setPdfPreviewTitle('IDEXX PDF');
  }, [pdfPreviewUrl, setShowPdfPreview, setPdfPreviewUrl, setPdfPreviewTitle]);

  const openResultPdfPreview = useCallback(
    async (resultId: string) => {
      if (!primaryOrgId || !resultId || pdfPreviewLoadingId === resultId) return;
      setPdfPreviewLoadingId(resultId);
      setError(null);
      try {
        const pdfBlob = await getIdexxResultPdfBlob({
          organisationId: primaryOrgId,
          resultId,
        });
        const objectUrl = URL.createObjectURL(pdfBlob);
        if (pdfPreviewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(pdfPreviewUrl);
        }
        setPdfPreviewUrl(objectUrl);
        setPdfPreviewTitle(`IDEXX Result PDF #${resultId}`);
        setShowPdfPreview(true);
      } catch (e) {
        setError(getApiErrorMessage(e, 'Unable to load IDEXX PDF preview.'));
      } finally {
        setPdfPreviewLoadingId(null);
      }
    },
    [
      primaryOrgId,
      pdfPreviewLoadingId,
      pdfPreviewUrl,
      setPdfPreviewLoadingId,
      setError,
      setPdfPreviewUrl,
      setPdfPreviewTitle,
      setShowPdfPreview,
    ]
  );

  const openOrderAcknowledgement = useCallback(
    (order: LabOrder | null) => {
      const pdfUrl = getOrderPdfUrl(order);
      if (!pdfUrl) {
        setError('Acknowledgment PDF is not available for this order yet.');
        return;
      }
      setError(null);
      setPdfPreviewTitle(`IDEXX Order Acknowledgment #${order?.idexxOrderId ?? ''}`.trim());
      setPdfPreviewUrl(pdfUrl);
      setShowPdfPreview(true);
    },
    [setError, setPdfPreviewTitle, setPdfPreviewUrl, setShowPdfPreview]
  );

  const openFollowUpWorkspace = useCallback(
    (order: LabOrder | null) => {
      const uiUrl = getOrderUiUrl(order);
      if (!uiUrl) {
        setError('Follow-up workspace URL is not available for this order.');
        return;
      }
      setError(null);
      setFollowUpFrameUrl(uiUrl);
      setShowFollowUpFrame(true);
    },
    [setError, setFollowUpFrameUrl, setShowFollowUpFrame]
  );

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
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const idexxIntegration = useIntegrationByProviderForPrimaryOrg('IDEXX');
  const integrationEnabled = (idexxIntegration?.status ?? '').toLowerCase() === 'enabled';

  const [results, setResults] = useState<LabResult[]>([]);
  const [censusEntries, setCensusEntries] = useState<CensusEntry[]>([]);
  const [appointmentIdByOrderId, setAppointmentIdByOrderId] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [modalityFilter, setModalityFilter] = useState<ModalityFilter>('ALL');
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
    const q = query.trim().toLowerCase();
    return results.filter((result) => {
      if (modalityFilter !== 'ALL') {
        const resultModality = normalizeModality(result.modality);
        if (resultModality !== modalityFilter) return false;
      }
      return !q || matchesResultQuery(result, q);
    });
  }, [results, query, modalityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));

  const paginatedResults = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredResults.slice(start, start + pageSize);
  }, [filteredResults, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const resultsColumns = useMemo(
    () =>
      buildResultsColumns({
        pdfPreviewLoadingId,
        getAppointmentLabsHref: actions.getAppointmentLabsHref,
        openResultDetails: actions.openResultDetails,
        openResultPdfPreview: actions.openResultPdfPreview,
      }),
    [
      pdfPreviewLoadingId,
      actions.getAppointmentLabsHref,
      actions.openResultDetails,
      actions.openResultPdfPreview,
    ]
  );

  const summary = useMemo(
    () => ({ totalResults: results.length, censusCount: censusEntries.length }),
    [results, censusEntries.length]
  );

  return {
    integrationEnabled,
    loading,
    error,
    autoRefresh,
    setAutoRefresh,
    query,
    setQuery,
    modalityFilter,
    setModalityFilter,
    pageSize,
    setPageSize,
    page,
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
    summary,
    censusEntries,
    actions,
  };
};

const IdexxWorkspacePage = () => {
  const s = useIdexxWorkspacePage();
  const autoRefreshLabel = getAutoRefreshLabel(s.autoRefresh);
  const refreshButtonLabel = getRefreshButtonLabel(s.loading);
  const resultModalOverlayClassName = getResultModalOverlayClassName(s.showResultModal);
  const resultModalContainerClassName = getResultModalContainerClassName(s.showResultModal);
  const startRow = getStartRow(s.page, s.pageSize, s.paginatedResults.length);

  if (!s.integrationEnabled && !s.loading) {
    return (
      <div className="flex flex-col gap-4 px-3! py-3! sm:px-12! lg:px-[60px]! sm:py-12!">
        <div className="text-heading-1 text-text-primary">IDEXX Hub</div>
        <div className="text-body-3 text-text-secondary">
          IDEXX integration is currently disabled.
        </div>
        <Link
          href="/integrations"
          className="text-body-4 text-text-brand underline underline-offset-2"
        >
          Open Integrations
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-3! py-3! sm:px-12! lg:px-[60px]! sm:py-12!">
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

      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="text-heading-1 text-text-primary">IDEXX Hub</div>
          <p className="text-body-3 text-text-secondary max-w-3xl">
            Manage diagnostic operations with result monitoring, census visibility, and order
            lookup.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Secondary
            href="#"
            text={autoRefreshLabel}
            onClick={() => s.setAutoRefresh((prev) => !prev)}
            className="px-4"
          />
          <Primary
            href="#"
            text={refreshButtonLabel}
            onClick={() => s.actions.refresh().catch(() => undefined)}
            className="px-4"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-2xl border border-card-border p-3 bg-white">
          <div className="text-caption-1 text-text-secondary">Results</div>
          <div className="text-body-3-emphasis text-text-primary">{s.summary.totalResults}</div>
        </div>
        <div className="rounded-2xl border border-card-border p-3 bg-white">
          <div className="text-caption-1 text-text-secondary">Census entries</div>
          <div className="text-body-3-emphasis text-text-primary">{s.summary.censusCount}</div>
        </div>
        <div className="rounded-2xl border border-card-border p-3 bg-white">
          <div className="text-caption-1 text-text-secondary">Last refreshed</div>
          <div className="text-body-4 text-text-primary">
            {formatDateTimeLocal(s.lastRefreshedAt, 'Not refreshed yet')}
          </div>
        </div>
      </div>

      {s.error ? <div className="text-body-4 text-text-error">{s.error}</div> : null}

      <Accordion title="Diagnostic orders and results" defaultOpen showEditIcon={false} isEditing>
        <div className="flex flex-col gap-3 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <FormInput
              intype="text"
              inname="idexx-results-search"
              inlabel="Search result / order"
              value={s.query}
              onChange={(e) => {
                s.setQuery(e.target.value);
                s.setPage(1);
              }}
            />
            <LabelDropdown
              placeholder="Modality"
              options={MODALITY_FILTERS}
              defaultOption={s.modalityFilter}
              onSelect={(option) => {
                s.setModalityFilter(option.value as ModalityFilter);
                s.setPage(1);
              }}
            />
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

          <div className="hidden xl:flex">
            <GenericTable data={s.paginatedResults} columns={s.resultsColumns} bordered={false} />
          </div>

          <div className="flex xl:hidden flex-col gap-3">
            <MobileResultsList
              paginatedResults={s.paginatedResults}
              getAppointmentLabsHref={s.actions.getAppointmentLabsHref}
              pdfPreviewLoadingId={s.pdfPreviewLoadingId}
              openResultDetails={s.actions.openResultDetails}
              openResultPdfPreview={s.actions.openResultPdfPreview}
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-caption-1 text-text-secondary">
              Showing {startRow}-{(s.page - 1) * s.pageSize + s.paginatedResults.length} of{' '}
              {s.filteredResults.length}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Back
                onClick={() => s.setPage((p) => Math.max(1, p - 1))}
                disabled={s.page <= 1}
                className={s.page <= 1 ? 'hover:bg-white! cursor-not-allowed opacity-40' : ''}
              />
              <div className="text-body-4 text-text-primary">
                Page {s.page} / {s.totalPages}
              </div>
              <Next
                onClick={() => s.setPage((p) => Math.min(s.totalPages, p + 1))}
                disabled={s.page >= s.totalPages}
                className={
                  s.page >= s.totalPages ? 'hover:bg-white! cursor-not-allowed opacity-40' : ''
                }
              />
            </div>
          </div>
        </div>
      </Accordion>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Accordion title="Census overview" defaultOpen showEditIcon={false} isEditing>
          <div className="flex flex-col gap-2 py-2 max-h-[420px] overflow-y-auto pr-1">
            <CensusEntriesList entries={s.censusEntries} />
          </div>
        </Accordion>

        <Accordion title="Order lookup" defaultOpen showEditIcon={false} isEditing>
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
              <FormInput
                intype="text"
                inname="idexx-order-id"
                inlabel="IDEXX order ID"
                value={s.orderLookupId}
                onChange={(e) => s.setOrderLookupId(e.target.value)}
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

      <ModalBase
        showModal={s.showResultModal}
        setShowModal={s.setShowResultModal}
        overlayClassName={resultModalOverlayClassName}
        containerClassName={resultModalContainerClassName}
      >
        <div className="flex flex-col h-full gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-heading-3 text-text-primary">Result details</div>
              <div className="text-body-4 text-text-secondary">
                Detailed diagnostic payload in Yosemite theme.
              </div>
            </div>
            <Close onClick={() => s.setShowResultModal(false)} />
          </div>

          <ResultDetailModalContent
            resultDetailLoading={s.resultDetailLoading}
            activeResultDetail={s.activeResultDetail}
          />
        </div>
      </ModalBase>
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

export default ProtectedIdexxWorkspace;
