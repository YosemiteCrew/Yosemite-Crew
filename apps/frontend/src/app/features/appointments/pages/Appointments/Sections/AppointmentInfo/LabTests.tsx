import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { MdOpenInNew } from 'react-icons/md';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import SearchDropdown from '@/app/ui/inputs/SearchDropdown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Close from '@/app/ui/primitives/Icons/Close';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';
import LabResultValue from '@/app/ui/widgets/LabResultValue';
import { Appointment } from '@yosemite-crew/types';
import { useOrgStore } from '@/app/stores/orgStore';
import { useIntegrationByProviderForPrimaryOrg } from '@/app/hooks/useIntegrations';
import {
  addPatientToIdexxCensus,
  createIdexxLabOrder,
  getApiErrorMessage,
  getIdexxCensus,
  getIdexxOrderById,
  getIdexxResultPdfBlob,
  listIdexxOrders,
  listIdexxIvlsDevices,
  listIdexxResults,
  listIdexxTests,
} from '@/app/features/integrations/services/idexxService';
import {
  CensusEntry,
  IdexxTest,
  IvlsDevice,
  LabOrder,
  LabResultTest,
  LabResult,
} from '@/app/features/integrations/services/types';
import { formatDateTimeLocal } from '@/app/lib/date';

const TESTS_PAGE_SIZE = 25;
const IDEXX_REGIONAL_AVAILABILITY_DISCLAIMER =
  'IDEXX integration availability is currently limited to the USA, Canada, and the UK.';

const getOrderResultProgressFromResults = (allResults: LabResult[], orderId: string): string => {
  const statuses = new Set(
    allResults
      .filter((result) => getResultOrderId(result) === String(orderId).trim())
      .map((result) => {
        const raw = result.rawPayload as { status?: string; statusDetail?: string } | undefined;
        return normalizeResultProgress(
          result.statusDetail ?? result.status ?? raw?.statusDetail ?? raw?.status
        );
      })
      .filter(Boolean)
  );
  if (statuses.has('In process')) return 'In process';
  if (statuses.has('Error')) return 'Error';
  if (statuses.has('Complete')) return 'Complete';
  return '';
};

const normalizeOrders = (orders: LabOrder[]): LabOrder[] =>
  [...orders].sort((a, b) => {
    const aDate = new Date(orderSortDate(a)).getTime();
    const bDate = new Date(orderSortDate(b)).getTime();
    return bDate - aDate;
  });

const resolveLatestOrder = (prev: LabOrder | null, normalizedOrders: LabOrder[]): LabOrder => {
  if (!prev) return normalizedOrders[0];
  return normalizedOrders.find((order) => order._id === prev._id) ?? normalizedOrders[0];
};

const mergeUniqueTests = (current: IdexxTest[], incoming: IdexxTest[]): IdexxTest[] => {
  const seen = new Set(current.map((item) => item.code || item._id));
  const next = [...current];
  incoming.forEach((item) => {
    const key = item.code || item._id;
    if (!seen.has(key)) {
      seen.add(key);
      next.push(item);
    }
  });
  return next;
};

const getResultOrderId = (result: LabResult) => {
  const raw = result.rawPayload as
    | { orderId?: string | number; requisitionId?: string | number }
    | undefined;
  return String(
    result.orderId ?? result.requisitionId ?? raw?.orderId ?? raw?.requisitionId ?? ''
  ).trim();
};

const formatTestPrice = (test: IdexxTest) => {
  const amount = String(test.meta?.listPrice ?? '').trim();
  if (!amount) return 'Rate unavailable';
  const currency = String(test.meta?.currencyCode ?? '').trim();
  if (!currency) return amount;
  const numericAmount = Number.parseFloat(amount.replaceAll(',', '.').replaceAll(/[^0-9.+-]/g, ''));
  if (!Number.isFinite(numericAmount)) return `${currency.toUpperCase()} ${amount}`;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      currencyDisplay: 'symbol',
    }).format(numericAmount);
  } catch {
    return `${currency.toUpperCase()} ${amount}`;
  }
};

const getTestTurnaround = (test: IdexxTest) =>
  String(test.meta?.turnaround ?? '').trim() || 'TAT not listed';

const getTestSpecimen = (test: IdexxTest) =>
  String(test.meta?.specimen ?? '').trim() || 'Specimen not listed';

const formatCensusIvlsDevices = (entry: CensusEntry | null) => {
  const devices = entry?.ivls ?? [];
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

const parseFloatSafe = (value?: string): number | null => {
  if (!value) return null;
  const normalized = String(value).replaceAll(',', '.');
  const allowedChars = '0123456789.+-';
  const cleaned = Array.from(normalized)
    .filter((char) => allowedChars.includes(char))
    .join('');
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
  const isOutOfRangeByValue = value < range.min || value > range.max;
  const percent = Math.min(100, Math.max(0, ((value - range.min) / (range.max - range.min)) * 100));
  const markerClass = test.outOfRange || isOutOfRangeByValue ? 'bg-red-500' : 'bg-text-primary';
  return { canRender: true, percent, markerClass };
};

const toTitleCase = (value?: string | null) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const normalized = raw.toLowerCase().replaceAll(/[_-]+/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const orderSortDate = (order: LabOrder) => order.updatedAt ?? order.createdAt ?? '';

const resolveOrderUiUrl = (order: LabOrder | null) => {
  if (!order) return '';
  const nested = String(
    (order as unknown as { responsePayload?: { uiURL?: string } })?.responsePayload?.uiURL ?? ''
  ).trim();
  return String(order.uiUrl ?? '').trim() || nested;
};

const resolveOrderPdfUrl = (order: LabOrder | null) => {
  if (!order) return '';
  const nested = String(
    (order as unknown as { responsePayload?: { pdfURL?: string } })?.responsePayload?.pdfURL ?? ''
  ).trim();
  return String(order.pdfUrl ?? '').trim() || nested;
};

const getNormalizedLifecycleStatus = (order: LabOrder | null) =>
  String(order?.externalStatus ?? order?.status ?? '')
    .trim()
    .toUpperCase()
    .replaceAll(/\s+/g, '_');

const formatOrderStatus = (order: LabOrder) => {
  const status = String(order.status ?? '').trim();
  const external = String(order.externalStatus ?? '').trim();
  if (external && external.toLowerCase() !== status.toLowerCase()) {
    return `${toTitleCase(status || '-')} (${toTitleCase(external)})`;
  }
  return toTitleCase(status || '-');
};

const normalizeResultProgress = (status?: string | null) => {
  const key = String(status ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  if (key.includes('PARTIAL') || key.includes('INPROCESS') || key.includes('IN_PROCESS'))
    return 'In process';
  if (key.includes('PENDING') || key.includes('RUNNING')) return 'In process';
  if (key.includes('COMPLETE') || key.includes('FINAL')) return 'Complete';
  if (key.includes('ERROR') || key.includes('FAIL')) return 'Error';
  return '';
};

const getOrderStatusBadgeClass = (
  order: LabOrder,
  resultProgressByOrderId: Map<string, string>
) => {
  const resultProgress = resultProgressByOrderId.get(String(order.idexxOrderId ?? '').trim());
  if (resultProgress === 'Complete') return 'bg-green-50 text-green-800';
  if (resultProgress === 'In process') return 'bg-amber-50 text-amber-700';
  if (resultProgress === 'Error') return 'bg-red-50 text-red-700';
  const key = String(order.status ?? '').toLowerCase();
  if (key.includes('submitted') || key.includes('complete') || key.includes('final'))
    return 'bg-green-50 text-green-800';
  if (key.includes('created') || key.includes('pending')) return 'bg-amber-50 text-amber-700';
  if (key.includes('error') || key.includes('failed') || key.includes('cancel'))
    return 'bg-red-50 text-red-700';
  return 'bg-card-hover text-text-secondary';
};

const shouldCloseOrderIframe = (args: {
  source: 'order' | 'followup';
  initialStatus: string | null;
  nextStatus: string;
  nextHasAcknowledgement: boolean;
  sawNonSubmittedStatus: boolean;
  initialUpdatedAt: string | null;
  nextUpdatedAt?: string;
  initialOrderId: string | null;
  newestKnownOrderId: string;
}) => {
  const {
    source,
    initialStatus,
    nextStatus,
    nextHasAcknowledgement,
    sawNonSubmittedStatus,
    initialUpdatedAt,
    nextUpdatedAt,
    initialOrderId,
    newestKnownOrderId,
  } = args;

  if (source === 'order') {
    const initialStatusKey = String(initialStatus ?? '')
      .trim()
      .toUpperCase()
      .replaceAll(/\s+/g, '_');
    const startedAsCreated = initialStatusKey === 'CREATED' || !initialStatusKey;
    const startedAsInProgress = ['IN_PROCESS', 'INPROCESS', 'PENDING'].includes(initialStatusKey);
    const updatedAtChanged = Boolean(
      initialUpdatedAt && nextUpdatedAt && nextUpdatedAt !== initialUpdatedAt
    );
    if (startedAsCreated) {
      return nextStatus === 'SUBMITTED' && nextHasAcknowledgement;
    }
    if (startedAsInProgress) {
      return (
        (sawNonSubmittedStatus || updatedAtChanged) &&
        nextStatus === 'SUBMITTED' &&
        nextHasAcknowledgement
      );
    }
    return false;
  }

  const updatedAtChanged = Boolean(
    initialUpdatedAt && nextUpdatedAt && nextUpdatedAt !== initialUpdatedAt
  );
  const followUpOrderCreated =
    Boolean(initialOrderId) && Boolean(newestKnownOrderId) && newestKnownOrderId !== initialOrderId;
  return updatedAtChanged || followUpOrderCreated;
};

// ---------- Sub-components ----------

const LabResultMeter = ({ test }: { test: LabResultTest }) => {
  const meter = getMeterMeta(test);
  if (!meter.canRender) {
    return <span className="text-caption-1 text-text-secondary">N/A</span>;
  }
  return (
    <div className="relative h-2 w-48 bg-card-hover rounded-full">
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-4 rounded ${meter.markerClass}`}
        style={{ left: `calc(${meter.percent}% - 3px)` }}
      />
    </div>
  );
};

const LabResultCategoryTable = ({
  category,
  resultId,
}: {
  category: { name: string; tests: LabResultTest[] };
  resultId: string;
}) => (
  <div key={`${resultId}-${category.name}`} className="rounded-xl border border-card-border p-2">
    <div className="text-body-4 text-text-primary mb-2">{category.name}</div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px]">
        <thead>
          <tr className="border-b border-card-border">
            <th className="text-left text-caption-1 text-text-tertiary py-1 pr-2">Test</th>
            <th className="text-left text-caption-1 text-text-tertiary py-1 pr-2">Value</th>
            <th className="text-left text-caption-1 text-text-tertiary py-1 pr-2">Reference</th>
            <th className="text-left text-caption-1 text-text-tertiary py-1">Meter</th>
          </tr>
        </thead>
        <tbody>
          {category.tests.map((test, idx) => (
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
                <LabResultMeter test={test} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const PastOrderCard = ({
  order,
  resultProgressByOrderId,
  getOrderDisplayStatus,
  openOrderIframe,
  openResultPdfForOrder,
  openOrderAcknowledgement,
  setActiveOrderForActions,
}: {
  order: LabOrder;
  resultProgressByOrderId: Map<string, string>;
  getOrderDisplayStatus: (o: LabOrder) => string;
  openOrderIframe: (
    source: 'order' | 'followup',
    statusOverride?: string | null,
    targetOrder?: LabOrder
  ) => void;
  openResultPdfForOrder: (o: LabOrder) => void;
  openOrderAcknowledgement: (o: LabOrder) => void;
  setActiveOrderForActions: (o: LabOrder) => void;
}) => (
  <div className="rounded-xl border border-card-border p-3 flex flex-col gap-2">
    <div className="flex items-start justify-between gap-2">
      <div>
        <div className="text-body-4 text-text-primary">Order {order.idexxOrderId}</div>
        <div className="text-caption-1 text-text-secondary">
          Updated: {formatDateTimeLocal(order.updatedAt, '-')}
        </div>
      </div>
      <span
        className={`text-label-xsmall px-2 py-1 rounded w-fit ${getOrderStatusBadgeClass(order, resultProgressByOrderId)}`}
      >
        {getOrderDisplayStatus(order)}
      </span>
    </div>
    <div className="flex flex-wrap items-center gap-2 justify-end">
      {getOrderDisplayStatus(order) === 'Complete' ? (
        <Primary href="#" text="Result PDF" onClick={() => openResultPdfForOrder(order)} />
      ) : (
        <Primary
          href="#"
          text="Open IDEXX"
          onClick={() => {
            setActiveOrderForActions(order);
            openOrderIframe('order', order.status, order);
          }}
          isDisabled={!resolveOrderUiUrl(order)}
        />
      )}
      <Secondary
        href="#"
        text="Acknowledgment PDF"
        onClick={() => openOrderAcknowledgement(order)}
        isDisabled={!resolveOrderPdfUrl(order)}
      />
    </div>
  </div>
);

// ---------- Custom hook ----------

const useLabTests = (activeAppointment: Appointment | null) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const idexxIntegration = useIntegrationByProviderForPrimaryOrg('IDEXX');
  const [integrationEnabled, setIntegrationEnabled] = useState(false);
  const [devices, setDevices] = useState<IvlsDevice[]>([]);
  const [tests, setTests] = useState<IdexxTest[]>([]);
  const [testsPage, setTestsPage] = useState(1);
  const [testsHasMore, setTestsHasMore] = useState(false);
  const [testsLoadingMore, setTestsLoadingMore] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedTestLabel, setSelectedTestLabel] = useState('');
  const [selectedTests, setSelectedTests] = useState<IdexxTest[]>([]);
  const [appointmentOrders, setAppointmentOrders] = useState<LabOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [modality, setModality] = useState<'REFERENCE_LAB' | 'INHOUSE'>('REFERENCE_LAB');
  const [selectedIvls, setSelectedIvls] = useState('');
  const [veterinarian, setVeterinarian] = useState('');
  const [technician, setTechnician] = useState('');
  const [notes, setNotes] = useState('');
  const [specimenCollectionDate, setSpecimenCollectionDate] = useState('');
  const [latestOrder, setLatestOrder] = useState<LabOrder | null>(null);
  const [results, setResults] = useState<LabResult[]>([]);
  const [censusEntries, setCensusEntries] = useState<CensusEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [updatingCensus, setUpdatingCensus] = useState(false);
  const [refreshingResults, setRefreshingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOrderIframe, setShowOrderIframe] = useState(false);
  const [iframeInitialStatus, setIframeInitialStatus] = useState<string | null>(null);
  const [iframeInitialResultProgress, setIframeInitialResultProgress] = useState<string | null>(
    null
  );
  const [iframeInitialUpdatedAt, setIframeInitialUpdatedAt] = useState<string | null>(null);
  const [iframeInitialOrderId, setIframeInitialOrderId] = useState<string | null>(null);
  const [iframeOrderUiUrl, setIframeOrderUiUrl] = useState<string | null>(null);
  const [iframeOpenSource, setIframeOpenSource] = useState<'order' | 'followup'>('order');
  const [iframeSawNonSubmittedStatus, setIframeSawNonSubmittedStatus] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState('IDEXX PDF');
  const [pdfPreviewLoadingId, setPdfPreviewLoadingId] = useState<string | null>(null);

  const companionId = activeAppointment?.companion?.id;
  const parentId = activeAppointment?.companion?.parent?.id;
  const normalizedOrderStatus = getNormalizedLifecycleStatus(latestOrder);
  const needsInitialOrderPlacement = normalizedOrderStatus === 'CREATED';

  const resultProgressByOrderId = useMemo(() => {
    const map = new Map<string, string>();
    appointmentOrders.forEach((order) => {
      const orderId = String(order.idexxOrderId ?? '').trim();
      if (!orderId) return;
      const progress = getOrderResultProgressFromResults(results, orderId);
      if (progress) map.set(orderId, progress);
    });
    return map;
  }, [appointmentOrders, results]);

  const canOpenFollowUpInCurrentOrder = Boolean(
    latestOrder &&
    resolveOrderUiUrl(latestOrder) &&
    !['INHOUSE', 'IN_HOUSE'].includes(String(latestOrder.modality ?? '').toUpperCase()) &&
    normalizedOrderStatus !== 'CREATED'
  );

  const getOrderDisplayStatus = useCallback(
    (order: LabOrder) =>
      resultProgressByOrderId.get(String(order.idexxOrderId ?? '').trim()) ||
      formatOrderStatus(order),
    [resultProgressByOrderId]
  );

  const upsertAppointmentOrder = useCallback((order: LabOrder) => {
    setAppointmentOrders((prev) => {
      const next = [order, ...prev.filter((item) => item._id !== order._id)];
      return normalizeOrders(next);
    });
  }, []);

  useEffect(() => {
    setSpecimenCollectionDate(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    const leadName = activeAppointment?.lead?.name ?? '';
    const firstSupportName = activeAppointment?.supportStaff?.[0]?.name ?? '';
    setVeterinarian(leadName);
    setTechnician(firstSupportName || leadName);
  }, [activeAppointment?.id, activeAppointment?.lead?.name, activeAppointment?.supportStaff]);

  useEffect(() => {
    setIntegrationEnabled(idexxIntegration?.status === 'enabled');
  }, [idexxIntegration?.status]);

  useEffect(() => {
    const run = async () => {
      if (!primaryOrgId || !integrationEnabled) {
        setDevices([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const ivls = await listIdexxIvlsDevices(primaryOrgId);
        setDevices(ivls.ivlsDeviceList ?? []);
      } catch (e) {
        setDevices([]);
        setError(getApiErrorMessage(e, 'Unable to load IDEXX integration/device state.'));
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [primaryOrgId, integrationEnabled]);

  const fetchTestsPage = useCallback(
    async (page: number, append: boolean) => {
      if (!primaryOrgId || !integrationEnabled) return;
      if (append) setTestsLoadingMore(true);
      try {
        const res = await listIdexxTests({
          organisationId: primaryOrgId,
          query,
          page,
          limit: TESTS_PAGE_SIZE,
        });
        const nextBatch = res.tests ?? [];
        setTests((prev) => (append ? mergeUniqueTests(prev, nextBatch) : nextBatch));
        setTestsPage(page);
        setTestsHasMore(nextBatch.length >= TESTS_PAGE_SIZE);
      } catch (e) {
        if (!append) setTests([]);
        setError(getApiErrorMessage(e, 'Unable to load IDEXX tests.'));
      } finally {
        if (append) setTestsLoadingMore(false);
      }
    },
    [integrationEnabled, primaryOrgId, query]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchTestsPage(1, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchTestsPage, query]);

  const loadMoreTests = useCallback(() => {
    if (!testsHasMore || testsLoadingMore) return;
    void fetchTestsPage(testsPage + 1, true);
  }, [fetchTestsPage, testsHasMore, testsLoadingMore, testsPage]);

  const refreshAppointmentOrders = useCallback(async () => {
    if (!primaryOrgId || !integrationEnabled || !activeAppointment?.id) {
      setAppointmentOrders([]);
      setLatestOrder(null);
      return;
    }
    setOrdersLoading(true);
    setError(null);
    try {
      const orders = await listIdexxOrders({
        organisationId: primaryOrgId,
        appointmentId: activeAppointment.id,
      });
      const normalized = normalizeOrders(orders);
      setAppointmentOrders(normalized);
      setLatestOrder((prev) => {
        if (!normalized.length) return null;
        if (!prev) return normalized[0];
        return normalized.find((order) => order._id === prev._id) ?? normalized[0];
      });
    } catch (e) {
      setAppointmentOrders([]);
      setLatestOrder(null);
      setError(getApiErrorMessage(e, 'Unable to load appointment lab orders.'));
    } finally {
      setOrdersLoading(false);
    }
  }, [activeAppointment?.id, integrationEnabled, primaryOrgId]);

  const refreshCensus = useCallback(async () => {
    if (!primaryOrgId || !integrationEnabled) return;
    try {
      const entries = await getIdexxCensus(primaryOrgId);
      setCensusEntries(entries);
    } catch (e) {
      setCensusEntries([]);
      setError(getApiErrorMessage(e, 'Unable to load IDEXX census.'));
    }
  }, [integrationEnabled, primaryOrgId]);

  const refreshResults = useCallback(async () => {
    if (!primaryOrgId || !integrationEnabled) return;
    setRefreshingResults(true);
    try {
      const appointmentOrderIds = new Set(
        appointmentOrders.map((order) => String(order.idexxOrderId ?? '').trim()).filter(Boolean)
      );
      if (appointmentOrderIds.size === 0) {
        setResults([]);
        return;
      }
      const allResults = await listIdexxResults(primaryOrgId);
      const filtered = allResults.filter((result) => {
        const companionMatch = companionId ? result.patientId === companionId : true;
        const resultOrderId = getResultOrderId(result);
        return companionMatch && appointmentOrderIds.has(resultOrderId);
      });
      setResults(filtered);
    } catch (e) {
      setResults([]);
      setError(getApiErrorMessage(e, 'Unable to load IDEXX results.'));
    } finally {
      setRefreshingResults(false);
    }
  }, [appointmentOrders, companionId, integrationEnabled, primaryOrgId]);

  useEffect(() => {
    void refreshResults();
  }, [refreshResults]);
  useEffect(() => {
    void refreshCensus();
  }, [refreshCensus]);
  useEffect(() => {
    void refreshAppointmentOrders();
  }, [refreshAppointmentOrders]);

  useEffect(() => {
    if (!showOrderIframe) return;
    if (!primaryOrgId || !iframeInitialOrderId) return;

    const interval = setInterval(async () => {
      try {
        const next = await getIdexxOrderById({
          organisationId: primaryOrgId,
          idexxOrderId: iframeInitialOrderId,
        });
        setLatestOrder(next);
        upsertAppointmentOrder(next);
        let newestKnownOrderId = String(next.idexxOrderId ?? '').trim();

        if (iframeOpenSource === 'followup' && activeAppointment?.id) {
          const appointmentOrderIds = new Set(
            appointmentOrders
              .map((order) => String(order.idexxOrderId ?? '').trim())
              .filter(Boolean)
          );
          if (appointmentOrderIds.size > 0) {
            const allResults = await listIdexxResults(primaryOrgId);
            const filtered = allResults.filter((result) => {
              const companionMatch = companionId ? result.patientId === companionId : true;
              const resultOrderId = getResultOrderId(result);
              return companionMatch && appointmentOrderIds.has(resultOrderId);
            });
            setResults(filtered);

            const nextProgress = getOrderResultProgressFromResults(filtered, next.idexxOrderId);
            if ((iframeInitialResultProgress ?? '') !== (nextProgress ?? '') && nextProgress) {
              setShowOrderIframe(false);
              return;
            }
          }

          const refreshedOrders = await listIdexxOrders({
            organisationId: primaryOrgId,
            appointmentId: activeAppointment.id,
          });
          const normalizedOrders = normalizeOrders(refreshedOrders);
          if (normalizedOrders.length > 0) {
            setAppointmentOrders(normalizedOrders);
            setLatestOrder((prev) => resolveLatestOrder(prev, normalizedOrders));
            newestKnownOrderId = String(normalizedOrders[0].idexxOrderId ?? '').trim();
          }
        }

        const nextStatus = getNormalizedLifecycleStatus(next);
        if (nextStatus !== 'SUBMITTED') {
          setIframeSawNonSubmittedStatus(true);
        }
        const nextHasAcknowledgement = Boolean(resolveOrderPdfUrl(next));
        if (
          shouldCloseOrderIframe({
            source: iframeOpenSource,
            initialStatus: iframeInitialStatus,
            nextStatus,
            nextHasAcknowledgement,
            sawNonSubmittedStatus: iframeSawNonSubmittedStatus,
            initialUpdatedAt: iframeInitialUpdatedAt,
            nextUpdatedAt: next.updatedAt,
            initialOrderId: iframeInitialOrderId,
            newestKnownOrderId,
          })
        ) {
          setShowOrderIframe(false);
          return;
        }
      } catch (e) {
        setError(getApiErrorMessage(e, 'Unable to poll order status while IDEXX frame is open.'));
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [
    showOrderIframe,
    primaryOrgId,
    activeAppointment?.id,
    iframeInitialOrderId,
    iframeOpenSource,
    iframeInitialStatus,
    iframeInitialResultProgress,
    iframeInitialUpdatedAt,
    iframeSawNonSubmittedStatus,
    upsertAppointmentOrder,
    appointmentOrders,
    companionId,
  ]);

  const openOrderIframe = useCallback(
    (source: 'order' | 'followup', statusOverride?: string | null, targetOrder?: LabOrder) => {
      const orderForFrame = targetOrder ?? latestOrder;
      const frameOrderId = String(orderForFrame?.idexxOrderId ?? '').trim();
      const frameUiUrl = resolveOrderUiUrl(orderForFrame);
      if (!frameOrderId || !frameUiUrl) {
        setError('IDEXX order frame is not available for this order.');
        return;
      }
      setIframeOpenSource(source);
      setIframeInitialStatus((statusOverride ?? orderForFrame?.status ?? '').toUpperCase() || null);
      setIframeInitialResultProgress(resultProgressByOrderId.get(frameOrderId) ?? null);
      setIframeInitialUpdatedAt(orderForFrame?.updatedAt ?? null);
      setIframeInitialOrderId(frameOrderId);
      setIframeOrderUiUrl(frameUiUrl);
      setIframeSawNonSubmittedStatus(false);
      setShowOrderIframe(true);
    },
    [latestOrder, resultProgressByOrderId]
  );

  const closeOrderIframeManually = useCallback(() => {
    setShowOrderIframe(false);
  }, []);

  const closePdfPreview = useCallback(() => {
    setShowPdfPreview(false);
    if (pdfPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(null);
    setPdfPreviewTitle('IDEXX PDF');
  }, [pdfPreviewUrl]);

  const openResultPdfPreview = useCallback(
    async (resultId: string) => {
      if (!primaryOrgId || !resultId || pdfPreviewLoadingId === resultId) return;
      setPdfPreviewLoadingId(resultId);
      setError(null);
      try {
        const pdfBlob = await getIdexxResultPdfBlob({ organisationId: primaryOrgId, resultId });
        const objectUrl = URL.createObjectURL(pdfBlob);
        if (pdfPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(objectUrl);
        setPdfPreviewTitle(`IDEXX Result PDF #${resultId}`);
        setShowPdfPreview(true);
      } catch (e) {
        setError(getApiErrorMessage(e, 'Unable to load IDEXX PDF preview.'));
      } finally {
        setPdfPreviewLoadingId(null);
      }
    },
    [primaryOrgId, pdfPreviewLoadingId, pdfPreviewUrl]
  );

  const openResultPdfForOrder = useCallback(
    async (order: LabOrder) => {
      const orderId = String(order.idexxOrderId ?? '').trim();
      if (!orderId) return;
      const candidates = results
        .filter((result) => getResultOrderId(result) === orderId)
        .sort((a, b) => {
          const aTime = Date.parse(a.updatedAt ?? a.createdAt ?? '');
          const bTime = Date.parse(b.updatedAt ?? b.createdAt ?? '');
          return bTime - aTime;
        });
      const latest = candidates[0];
      if (!latest?.resultId) {
        setError('Result PDF is not available for this order yet.');
        return;
      }
      await openResultPdfPreview(latest.resultId);
    },
    [openResultPdfPreview, results]
  );

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  const openOrderAcknowledgement = useCallback((order: LabOrder) => {
    const pdfUrl = resolveOrderPdfUrl(order);
    if (!pdfUrl) {
      setError('Acknowledgment PDF is not available for this order.');
      return;
    }
    setError(null);
    setPdfPreviewTitle(`IDEXX Order Acknowledgment #${order.idexxOrderId}`);
    setPdfPreviewUrl(pdfUrl);
    setShowPdfPreview(true);
  }, []);

  const setActiveOrderForActions = useCallback((order: LabOrder) => {
    setLatestOrder(order);
  }, []);

  const addTest = useCallback(
    (value: string) => {
      const match = tests.find((test) => test.code === value || test._id === value);
      if (!match) return;
      setSelectedTestLabel('');
      setQuery('');
      setSelectedTests((prev) => {
        if (prev.some((test) => test.code === match.code)) return prev;
        return [...prev, match];
      });
    },
    [tests]
  );

  const removeTest = useCallback((code: string) => {
    setSelectedTests((prev) => prev.filter((test) => test.code !== code));
  }, []);

  const handleCreateOrder = useCallback(async () => {
    if (!primaryOrgId || !companionId || selectedTests.length === 0) return;
    setCreatingOrder(true);
    setError(null);
    try {
      const payload = {
        companionId,
        appointmentId: activeAppointment?.id,
        tests: selectedTests.map((test) => test.code),
        modality,
        veterinarian: veterinarian || undefined,
        technician: technician || undefined,
        notes: notes || undefined,
        specimenCollectionDate: specimenCollectionDate || undefined,
      };
      const created = await createIdexxLabOrder({ organisationId: primaryOrgId, payload });
      setLatestOrder(created);
      upsertAppointmentOrder(created);
      setSelectedTests([]);
      setSelectedTestLabel('');
      setQuery('');
      openOrderIframe('order', created.status, created);
      await refreshAppointmentOrders();
      await refreshResults();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Unable to create IDEXX lab order.'));
    } finally {
      setCreatingOrder(false);
    }
  }, [
    primaryOrgId,
    companionId,
    selectedTests,
    activeAppointment?.id,
    modality,
    veterinarian,
    technician,
    notes,
    specimenCollectionDate,
    upsertAppointmentOrder,
    openOrderIframe,
    refreshAppointmentOrders,
    refreshResults,
  ]);

  const handleAddToCensus = useCallback(async () => {
    if (!primaryOrgId || !companionId) return;
    setUpdatingCensus(true);
    setError(null);
    try {
      await addPatientToIdexxCensus({
        organisationId: primaryOrgId,
        payload: {
          companionId,
          parentId: parentId || undefined,
          veterinarian: veterinarian || undefined,
          ivls: selectedIvls ? [selectedIvls] : undefined,
        },
      });
      await refreshCensus();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Unable to add companion to IDEXX census.'));
    } finally {
      setUpdatingCensus(false);
    }
  }, [primaryOrgId, companionId, parentId, veterinarian, selectedIvls, refreshCensus]);

  const modalityOptions = useMemo(
    () => [
      { label: 'Reference lab', value: 'REFERENCE_LAB' },
      { label: 'In-house', value: 'INHOUSE' },
    ],
    []
  );

  const practitionerOptions = useMemo(() => {
    const options: Array<{ label: string; value: string }> = [];
    const seen = new Set<string>();
    const addOption = (name?: string) => {
      const trimmed = String(name ?? '').trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      options.push({ label: trimmed, value: trimmed });
    };
    addOption(activeAppointment?.lead?.name);
    (activeAppointment?.supportStaff ?? []).forEach((staff) => addOption(staff.name));
    return options;
  }, [activeAppointment?.lead?.name, activeAppointment?.supportStaff]);

  const companionInCensus = useMemo(
    () => censusEntries.some((entry) => entry.patient?.patientId === companionId),
    [censusEntries, companionId]
  );

  const companionCensusEntry = useMemo(
    () => censusEntries.find((entry) => entry.patient?.patientId === companionId) ?? null,
    [censusEntries, companionId]
  );

  const selectedDeviceInCensus = useMemo(() => {
    if (!companionCensusEntry || !selectedIvls) return false;
    return (companionCensusEntry.ivls ?? []).some(
      (device) => String(device.serialNumber ?? '').trim() === selectedIvls
    );
  }, [companionCensusEntry, selectedIvls]);

  const inHouseCensusConfirmed = useMemo(() => {
    if (!companionCensusEntry) return false;
    const confirmedBy = companionCensusEntry.confirmedBy ?? [];
    if (selectedIvls) return confirmedBy.includes(selectedIvls);
    return Boolean(companionCensusEntry.confirmed || confirmedBy.length > 0);
  }, [companionCensusEntry, selectedIvls]);

  const needsSelectedDeviceCensusAdd = useMemo(() => {
    if (!selectedIvls) return false;
    return !companionInCensus;
  }, [companionInCensus, selectedIvls]);

  return {
    // state
    integrationEnabled,
    loading,
    error,
    devices,
    tests,
    testsHasMore,
    testsLoadingMore,
    query,
    setQuery,
    selectedTestLabel,
    setSelectedTestLabel,
    selectedTests,
    modality,
    setModality,
    selectedIvls,
    setSelectedIvls,
    veterinarian,
    setVeterinarian,
    technician,
    setTechnician,
    notes,
    setNotes,
    specimenCollectionDate,
    setSpecimenCollectionDate,
    latestOrder,
    appointmentOrders,
    ordersLoading,
    results,
    censusEntries,
    creatingOrder,
    updatingCensus,
    refreshingResults,
    showOrderIframe,
    iframeOrderUiUrl,
    iframeOpenSource,
    showPdfPreview,
    pdfPreviewUrl,
    pdfPreviewTitle,
    pdfPreviewLoadingId,
    // derived
    needsInitialOrderPlacement,
    canOpenFollowUpInCurrentOrder,
    resultProgressByOrderId,
    companionInCensus,
    selectedDeviceInCensus,
    inHouseCensusConfirmed,
    needsSelectedDeviceCensusAdd,
    modalityOptions,
    practitionerOptions,
    companionId,
    // actions
    loadMoreTests,
    refreshAppointmentOrders,
    refreshCensus,
    refreshResults,
    openOrderIframe,
    closeOrderIframeManually,
    closePdfPreview,
    openResultPdfPreview,
    openResultPdfForOrder,
    openOrderAcknowledgement,
    setActiveOrderForActions,
    addTest,
    removeTest,
    handleCreateOrder,
    handleAddToCensus,
    getOrderDisplayStatus,
  };
};

// ---------- Sub-components ----------

type UseLabTestsReturn = ReturnType<typeof useLabTests>;

const getCensusStatusLabel = (selectedIvls: string, companionInCensus: boolean): string => {
  if (selectedIvls) return companionInCensus ? 'Already added to census' : 'Not added to census';
  return companionInCensus ? 'Added' : 'Not added';
};

const getCensusDescription = (selectedIvls: string, companionInCensus: boolean): string => {
  if (selectedIvls) {
    return companionInCensus
      ? 'Companion already exists in IDEXX census. IDEXX only allows one census entry per patient.'
      : 'Add this companion to IDEXX census before running in-house diagnostics.';
  }
  return companionInCensus
    ? 'Companion is present in IDEXX census for this appointment companion.'
    : 'Add this companion to IDEXX census before running in-house diagnostics.';
};

const getIvlsConfirmationLabel = (
  selectedIvls: string,
  inHouseCensusConfirmed: boolean
): string => {
  if (!selectedIvls) return 'Select an IVLS device to check confirmation state';
  return inHouseCensusConfirmed ? 'Confirmed for selected device' : 'Pending for selected device';
};

const getAppointmentStateLabel = (
  selectedIvls: string,
  companionInCensus: boolean,
  selectedDeviceInCensus: boolean,
  inHouseCensusConfirmed: boolean
): string => {
  if (!selectedIvls) return 'Select an IVLS device';
  if (!companionInCensus) return 'Not yet added to census';
  if (!selectedDeviceInCensus) return 'Already in census under another device';
  return inHouseCensusConfirmed
    ? 'Ready on selected IVLS device'
    : 'Added to selected device census, awaiting IVLS confirmation';
};

const InhouseCensusStatus = ({ s }: { s: UseLabTestsReturn }) => {
  const censusStatusLabel = getCensusStatusLabel(s.selectedIvls, s.companionInCensus);
  const censusDescription = getCensusDescription(s.selectedIvls, s.companionInCensus);
  const ivlsConfirmationLabel = getIvlsConfirmationLabel(s.selectedIvls, s.inHouseCensusConfirmed);
  const appointmentStateLabel = getAppointmentStateLabel(
    s.selectedIvls,
    s.companionInCensus,
    s.selectedDeviceInCensus,
    s.inHouseCensusConfirmed
  );
  const censusEntry =
    s.censusEntries.find((entry) => entry.patient?.patientId === s.companionId) ?? null;

  return (
    <div
      className={`rounded-2xl border p-3 ${s.companionInCensus ? 'border-green-200 bg-green-50' : 'border-card-border'}`}
    >
      <div className="text-body-4 text-text-primary">
        Companion census status: {censusStatusLabel}
      </div>
      <div className="text-caption-1 text-text-secondary mt-1">{censusDescription}</div>
      {s.companionInCensus && (
        <div className="text-caption-1 text-text-secondary mt-1">
          IVLS confirmation: {ivlsConfirmationLabel}
        </div>
      )}
      {s.companionInCensus && (
        <div className="text-caption-1 text-text-secondary mt-1">
          Census device ID: {formatCensusIvlsDevices(censusEntry)}
        </div>
      )}
      <div className="text-caption-1 text-text-secondary mt-1">
        Current appointment state: {appointmentStateLabel}
      </div>
      {s.needsSelectedDeviceCensusAdd && (
        <div className="mt-3">
          <Primary
            href="#"
            text={s.updatingCensus ? 'Adding to census...' : 'Add to census'}
            onClick={s.handleAddToCensus}
            isDisabled={s.updatingCensus || !s.companionId || !s.selectedIvls}
          />
        </div>
      )}
    </div>
  );
};

const ReferenceLabForm = ({ s }: { s: UseLabTestsReturn }) => (
  <>
    <div className="text-caption-1 text-text-secondary">
      IDEXX test reference data does not explicitly flag tests as in-house vs device-specific in
      this contract. Use reference lab for external IDEXX ordering.
    </div>
    <SearchDropdown
      placeholder="Search IDEXX tests"
      options={s.tests.map((test) => ({
        value: test.code,
        label: `${test.display} (${test.code})`,
        meta: test,
      }))}
      onSelect={s.addTest}
      query={s.selectedTestLabel || s.query}
      setQuery={(value: string) => {
        s.setSelectedTestLabel(value);
        s.setQuery(value);
      }}
      minChars={0}
      onReachEnd={s.loadMoreTests}
      hasMore={s.testsHasMore}
      isLoadingMore={s.testsLoadingMore}
      optionClassName="w-full text-start rounded-2xl! border border-card-border bg-white px-3 py-2 mb-2 last:mb-0 hover:bg-white transition-colors"
      renderOption={(option) => {
        const test = option.meta as IdexxTest | undefined;
        if (!test) return option.label;
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <div className="text-body-4 text-text-primary pr-2">{test.display}</div>
              <div className="text-label-xsmall px-2 py-1 rounded bg-blue-50 text-blue-700 whitespace-nowrap">
                {formatTestPrice(test)}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-caption-1 text-text-secondary">
              <span>Code: {test.code}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-caption-1 text-text-secondary">
              <span>Turnaround time: {getTestTurnaround(test)}</span>
              <span>Specimen: {getTestSpecimen(test)}</span>
            </div>
          </div>
        );
      }}
    />

    <div className="flex flex-wrap gap-2">
      {s.selectedTests.length === 0 ? (
        <div className="text-body-4 text-text-secondary">No tests selected yet.</div>
      ) : (
        s.selectedTests.map((test) => (
          <button
            key={test.code}
            type="button"
            onClick={() => s.removeTest(test.code)}
            className="rounded-xl! border border-card-border bg-white px-3 py-2 text-left min-w-[220px] max-w-[280px] transition-colors hover:bg-white"
            title="Remove test from selection"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-body-4 text-text-primary truncate">{test.display}</div>
              <div className="text-label-xsmall px-2 py-1 rounded bg-blue-50 text-blue-700 whitespace-nowrap">
                {formatTestPrice(test)}
              </div>
            </div>
            <div className="mt-0.5 text-caption-1 text-text-secondary truncate">
              {test.code} • Turnaround time: {getTestTurnaround(test)}
            </div>
          </button>
        ))
      )}
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <LabelDropdown
        placeholder="Veterinarian"
        options={s.practitionerOptions}
        defaultOption={s.veterinarian}
        onSelect={(option) => s.setVeterinarian(option.value)}
      />
      <LabelDropdown
        placeholder="Technician"
        options={s.practitionerOptions}
        defaultOption={s.technician}
        onSelect={(option) => s.setTechnician(option.value)}
      />
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <FormInput
        intype="date"
        inname="lab-specimen-date"
        inlabel="Specimen collection date"
        value={s.specimenCollectionDate}
        onChange={(e) => s.setSpecimenCollectionDate(e.target.value)}
      />
      <FormInput
        intype="text"
        inname="lab-notes"
        inlabel="Notes"
        value={s.notes}
        onChange={(e) => s.setNotes(e.target.value)}
      />
    </div>

    <Primary
      href="#"
      text={s.creatingOrder ? 'Creating order...' : 'Create IDEXX order'}
      onClick={s.handleCreateOrder}
      isDisabled={s.creatingOrder || s.loading || s.selectedTests.length === 0 || !s.companionId}
    />
  </>
);

const InhouseLabForm = ({ s }: { s: UseLabTestsReturn }) => (
  <>
    <div className="text-body-4 text-text-secondary">
      In-house IDEXX workflow requires selecting an IVLS device, then adding the companion to census
      here. Complete ordering on the IDEXX machine after census is confirmed.
    </div>
    <LabelDropdown
      placeholder="Select IVLS device"
      options={s.devices.map((device) => ({
        label: `${device.displayName || 'IVLS'} (${device.deviceSerialNumber})`,
        value: device.deviceSerialNumber,
      }))}
      defaultOption={s.selectedIvls}
      onSelect={(option) => s.setSelectedIvls(option.value)}
    />
    <InhouseCensusStatus s={s} />
    <Secondary href="#" text="Refresh census" onClick={() => void s.refreshCensus()} />
  </>
);

const LabOrderForm = ({ s }: { s: UseLabTestsReturn }) => (
  <Accordion title="Create lab order" defaultOpen showEditIcon={false} isEditing>
    <div className="flex flex-col gap-3 py-2">
      <LabelDropdown
        placeholder="Modality"
        options={s.modalityOptions}
        defaultOption={s.modality}
        onSelect={(option) => s.setModality(option.value as 'REFERENCE_LAB' | 'INHOUSE')}
      />
      {s.modality === 'REFERENCE_LAB' ? <ReferenceLabForm s={s} /> : <InhouseLabForm s={s} />}
    </div>
  </Accordion>
);

const LabOrderStatus = ({
  s,
  orderButtonText,
}: {
  s: UseLabTestsReturn;
  orderButtonText: string;
}) => (
  <Accordion title="Order status and requisition" defaultOpen showEditIcon={false} isEditing>
    <div className="flex flex-col gap-3 py-2">
      <div className="flex items-center justify-end">
        <Secondary
          href="#"
          text={s.ordersLoading ? 'Refreshing orders...' : 'Refresh appointment orders'}
          onClick={() => void s.refreshAppointmentOrders()}
          isDisabled={s.ordersLoading}
        />
      </div>
      {s.latestOrder ? (
        <>
          <div className="rounded-2xl border border-card-border p-3 bg-white flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <div className="text-body-3 text-text-primary">
                  Order {s.latestOrder.idexxOrderId}
                </div>
                <div className="text-caption-1 text-text-secondary">
                  Updated: {formatDateTimeLocal(s.latestOrder.updatedAt, '-')}
                </div>
              </div>
              <span
                className={`text-label-xsmall px-2 py-1 rounded w-fit ${getOrderStatusBadgeClass(s.latestOrder, s.resultProgressByOrderId)}`}
              >
                {s.getOrderDisplayStatus(s.latestOrder)}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Primary
                href="#"
                text={
                  s.getOrderDisplayStatus(s.latestOrder) === 'Complete'
                    ? 'Result PDF'
                    : orderButtonText
                }
                onClick={() => {
                  if (!s.latestOrder) return;
                  if (s.getOrderDisplayStatus(s.latestOrder) === 'Complete') {
                    void s.openResultPdfForOrder(s.latestOrder);
                    return;
                  }
                  s.openOrderIframe(s.canOpenFollowUpInCurrentOrder ? 'followup' : 'order');
                }}
                isDisabled={
                  s.getOrderDisplayStatus(s.latestOrder) === 'Complete'
                    ? false
                    : !resolveOrderUiUrl(s.latestOrder)
                }
              />
              <Secondary
                href="#"
                text="Acknowledgment PDF"
                onClick={() => s.openOrderAcknowledgement(s.latestOrder!)}
                isDisabled={!resolveOrderPdfUrl(s.latestOrder)}
              />
            </div>
          </div>
          {s.appointmentOrders.length > 1 ? (
            <div className="rounded-2xl border border-card-border p-3 flex flex-col gap-2">
              <div className="text-body-4 text-text-primary">Past orders in this appointment</div>
              {s.appointmentOrders
                .filter((order) => order._id !== s.latestOrder!._id)
                .map((order) => (
                  <PastOrderCard
                    key={order._id}
                    order={order}
                    resultProgressByOrderId={s.resultProgressByOrderId}
                    getOrderDisplayStatus={s.getOrderDisplayStatus}
                    openOrderIframe={s.openOrderIframe}
                    openResultPdfForOrder={s.openResultPdfForOrder}
                    openOrderAcknowledgement={s.openOrderAcknowledgement}
                    setActiveOrderForActions={s.setActiveOrderForActions}
                  />
                ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="text-body-4 text-text-secondary">
          {s.ordersLoading
            ? 'Loading appointment lab orders...'
            : 'No lab orders found for this appointment yet.'}
        </div>
      )}
    </div>
  </Accordion>
);

const LabResultsList = ({ s }: { s: UseLabTestsReturn }) => (
  <Accordion title="Results" defaultOpen showEditIcon={false} isEditing>
    <div className="flex flex-col gap-3 py-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-caption-1 text-text-secondary">
          Results are filtered for this companion and all orders mapped to this appointment.
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Primary
            href="#"
            text={s.refreshingResults ? 'Refreshing...' : 'Refresh'}
            onClick={() => void s.refreshResults()}
            isDisabled={s.refreshingResults}
          />
          <Link
            href="/appointments/idexx-workspace"
            aria-label="Open IDEXX Hub"
            className="h-8 w-8 rounded-full border border-card-border bg-white text-text-secondary hover:text-text-brand hover:border-text-brand transition-colors inline-flex items-center justify-center"
          >
            <MdOpenInNew size={16} />
          </Link>
        </div>
      </div>

      {s.results.length === 0 ? (
        <div className="text-body-4 text-text-secondary">No results available yet.</div>
      ) : (
        s.results.map((result, index) => (
          <div
            key={result.resultId}
            className="rounded-2xl border border-card-border p-3 flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-body-3 text-text-primary">Result {index + 1}</div>
                <div className="text-caption-1 text-text-secondary">
                  ID: {result.resultId} | Status: {toTitleCase(result.status)} | Order:{' '}
                  {result.orderId ?? '-'}
                </div>
              </div>
              <Primary
                href="#"
                text={s.pdfPreviewLoadingId === result.resultId ? '...' : 'PDF'}
                onClick={() => void s.openResultPdfPreview(result.resultId)}
                isDisabled={s.pdfPreviewLoadingId === result.resultId}
              />
            </div>

            {(result.rawPayload?.categories ?? []).map((category) => (
              <LabResultCategoryTable
                key={`${result.resultId}-${category.name}`}
                category={category}
                resultId={result.resultId}
              />
            ))}
          </div>
        ))
      )}
      <div className="text-caption-2 text-text-extra">{IDEXX_REGIONAL_AVAILABILITY_DISCLAIMER}</div>
    </div>
  </Accordion>
);

// ---------- Main component ----------

type LabTestsProps = {
  activeAppointment: Appointment | null;
};

const LabTests = ({ activeAppointment }: LabTestsProps) => {
  const s = useLabTests(activeAppointment);

  if (s.loading) {
    return <div className="text-body-4 text-text-secondary">Loading IDEXX integration...</div>;
  }

  if (!s.integrationEnabled) {
    return (
      <div className="flex flex-col gap-3 w-full">
        <div className="text-body-3 text-text-primary">
          IDEXX integration is not enabled for this organization.
        </div>
        <Link
          href="/integrations"
          className="text-body-4 text-text-brand underline underline-offset-2"
        >
          Enable IDEXX in Integrations
        </Link>
      </div>
    );
  }

  const iframeTitle =
    s.iframeOpenSource === 'followup' ? 'IDEXX follow-up ordering' : 'IDEXX ordering';
  const orderIframeUrl = s.iframeOrderUiUrl || resolveOrderUiUrl(s.latestOrder);
  let orderButtonText = 'Open IDEXX';
  if (s.needsInitialOrderPlacement) {
    orderButtonText = 'Resume order placement';
  } else if (s.canOpenFollowUpInCurrentOrder) {
    orderButtonText = 'Follow up';
  }

  return (
    <>
      {s.showOrderIframe && orderIframeUrl && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              data-signing-overlay="true"
              style={{ pointerEvents: 'auto' }}
            >
              <div className="relative bg-white rounded-2xl shadow-2xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-black/10">
                  <div className="text-body-2 text-text-primary">{iframeTitle}</div>
                  <button
                    type="button"
                    onClick={s.closeOrderIframeManually}
                    className="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer"
                    aria-label="Close IDEXX order frame"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <Close iconOnly />
                  </button>
                </div>
                <iframe
                  src={orderIframeUrl}
                  title="IDEXX order UI"
                  className="flex-1 w-full border-0"
                  loading="lazy"
                  allowFullScreen
                  style={{ pointerEvents: 'auto' }}
                />
              </div>
            </div>,
            document.body
          )
        : null}
      <PdfPreviewOverlay
        open={s.showPdfPreview}
        pdfUrl={s.pdfPreviewUrl}
        title={s.pdfPreviewTitle}
        closeLabel="Close IDEXX PDF preview"
        onClose={s.closePdfPreview}
      />

      <div className="flex flex-col gap-4 w-full">
        {s.error ? <div className="text-body-4 text-text-error">{s.error}</div> : null}
        <LabOrderForm s={s} />
        <LabOrderStatus s={s} orderButtonText={orderButtonText} />
        <LabResultsList s={s} />
      </div>
    </>
  );
};

export default LabTests;
